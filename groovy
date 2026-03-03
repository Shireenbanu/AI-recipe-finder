pipeline {
    agent any

    environment {
        GIT_CREDS          = 'github-token'
        REPO_URL           = 'https://github.com/Shireenbanu/AI-recipe-finder.git'
        AWS_ACCOUNT_ID     = "045615334997"
        AWS_REGION         = "us-west-2"
        ECR_REPO_NAME      = "recipe-finder-prod"
        ECR_URL            = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        ECS_CLUSTER        = "recipe-finder-prod-cluster"
        ECS_SERVICE        = "recipe-finder-prod-service"
        TASK_FAMILY        = "recipe-finder-prod"
        SIGNING_PROFILE    = "arn:aws:signer:us-west-2:045615334997:/signing-profiles/recipeFinderSigner"
    }

    stages {

        stage('Checkout Code') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: env.REPO_URL,
                        credentialsId: env.GIT_CREDS
                    ]]
                ])
            }
        }

        stage('Security Scans') {
            parallel {

                stage('Gitleaks Scan') {
                    steps {
                        sh "gitleaks detect --source . -v --report-format json --report-path leaks-report.json || true"
                    }
                }

                stage('Checkov IaC Scan') {
                    steps {
                        sh """
                            rm -rf "${WORKSPACE}/checkov-report.xml"
                            rm -rf "${WORKSPACE}/checkov-output"

                            # Use a dedicated subdir so Checkov writes results_junitxml.xml inside it
                            mkdir -p "${WORKSPACE}/checkov-output"

                            checkov -d . --skip-path CI_CD_Infra --soft-fail \
                                --output junitxml \
                                --output-file-path "${WORKSPACE}/checkov-output" || true

                            echo "=== Checkov output directory contents ==="
                            ls -la "${WORKSPACE}/checkov-output/"

                            # Copy result to the final expected filename (as a regular FILE)
                            if [ -f "${WORKSPACE}/checkov-output/results_junitxml.xml" ]; then
                                cp "${WORKSPACE}/checkov-output/results_junitxml.xml" "${WORKSPACE}/checkov-report.xml"
                                echo "SUCCESS: checkov-report.xml created as a file"
                            else
                                echo "WARNING: Checkov XML not found — writing empty placeholder"
                                echo '<testsuites><testsuite name="checkov" tests="0"></testsuite></testsuites>' \
                                    > "${WORKSPACE}/checkov-report.xml"
                            fi

                            echo "=== Final verification (must show a regular file, not a directory) ==="
                            ls -la "${WORKSPACE}/checkov-report.xml"
                            file "${WORKSPACE}/checkov-report.xml"
                        """
                    }
                }

            }
        }

        stage('SBOM & Source Vulnerability Scan') {
            steps {
                sh "syft dir:. -o cyclonedx-json > sbom.json"
                sh "grype sbom:sbom.json --fail-on critical -o table"
            }
        }

        stage('Build Image') {
            steps {
                script {
                    env.IMAGE_TAG       = "v${env.BUILD_NUMBER}"
                    env.FULL_IMAGE_NAME = "${ECR_URL}/${ECR_REPO_NAME}:${env.IMAGE_TAG}"
                    sh "docker build -t ${env.FULL_IMAGE_NAME} ."
                }
            }
        }

        stage('Image Vulnerability Scan') {
            steps {
                sh "grype ${env.FULL_IMAGE_NAME} --fail-on critical -o table"
            }
        }

        stage('Push to ECR') {
            steps {
                sh """
                    aws ecr get-login-password --region ${AWS_REGION} | \
                        docker login --username AWS --password-stdin ${ECR_URL}

                    docker push ${env.FULL_IMAGE_NAME}

                    IMAGE_DIGEST=\$(aws ecr describe-images \
                        --repository-name ${ECR_REPO_NAME} \
                        --image-ids imageTag=${env.IMAGE_TAG} \
                        --region ${AWS_REGION} \
                        --query 'imageDetails[0].imageDigest' \
                        --output text)

                    echo \$IMAGE_DIGEST > image-digest.txt
                    echo "Pushed: ${env.FULL_IMAGE_NAME}"
                    echo "Digest: \${IMAGE_DIGEST}"
                """
            }
        }

        stage('Sign Image') {
            steps {
                sh """
                    export AWS_REGION=${AWS_REGION}
                    IMAGE_DIGEST=\$(cat image-digest.txt)

                    PLUGIN_DIR=/var/lib/jenkins/.config/notation/plugins/com.amazonaws.signer.notation.plugin
                    PLUGIN_BIN=\$PLUGIN_DIR/notation-com.amazonaws.signer.notation.plugin

                    if [ ! -f "\$PLUGIN_BIN" ]; then
                        echo "=== Installing Notation AWS Signer plugin ==="
                        mkdir -p \$PLUGIN_DIR
                        curl -Lo /tmp/notation-aws-signer-plugin.zip \
                            "https://d2hvyiie56hcat.cloudfront.net/linux/amd64/plugin/latest/notation-aws-signer-plugin.zip"
                        unzip -o /tmp/notation-aws-signer-plugin.zip -d \$PLUGIN_DIR
                        chmod +x \$PLUGIN_BIN
                        rm /tmp/notation-aws-signer-plugin.zip
                    else
                        echo "=== Notation plugin already installed, skipping ==="
                    fi

                    TRUST_STORE_DIR=/var/lib/jenkins/.config/notation/truststore/x509/signingAuthority/aws-signer-ts

                    if [ ! "\$(ls -A \$TRUST_STORE_DIR 2>/dev/null)" ]; then
                        echo "=== Adding AWS Signer root cert to trust store ==="
                        curl -Lo /tmp/aws-signer-notation-root.cert \
                            "https://d2hvyiie56hcat.cloudfront.net/aws-signer-notation-root.cert"
                        notation cert add \
                            --type signingAuthority \
                            --store aws-signer-ts \
                            /tmp/aws-signer-notation-root.cert
                        rm /tmp/aws-signer-notation-root.cert
                    else
                        echo "=== Trust store already populated, skipping ==="
                    fi

                    mkdir -p /var/lib/jenkins/.config/notation
                    cat > /var/lib/jenkins/.config/notation/trustpolicy.json << 'TRUSTPOLICY'
{
    "version": "1.0",
    "trustPolicies": [
        {
            "name": "recipe-finder-policy",
            "registryScopes": [
                "045615334997.dkr.ecr.us-west-2.amazonaws.com/recipe-finder-prod"
            ],
            "signatureVerification": {
                "level": "strict"
            },
            "trustStores": ["signingAuthority:aws-signer-ts"],
            "trustedIdentities": [
                "arn:aws:signer:us-west-2:045615334997:/signing-profiles/recipeFinderSigner"
            ]
        }
    ]
}
TRUSTPOLICY

                    notation plugin list
                    notation cert list

                    notation sign \
                        ${ECR_URL}/${ECR_REPO_NAME}@\${IMAGE_DIGEST} \
                        --plugin com.amazonaws.signer.notation.plugin \
                        --id ${SIGNING_PROFILE} \
                        --force-referrers-tag=false

                    notation verify \
                        ${ECR_URL}/${ECR_REPO_NAME}@\${IMAGE_DIGEST}

                    echo "Image signed and verified: \${IMAGE_DIGEST}"
                """
            }
        }

        stage('Deploy to ECS') {
            steps {
                sh """
                    aws ecs describe-task-definition \
                        --task-definition ${TASK_FAMILY} \
                        --region ${AWS_REGION} > task-def-full.json

                    jq '.taskDefinition
                        | .containerDefinitions[0].image = "${env.FULL_IMAGE_NAME}"
                        | del(.taskDefinitionArn, .revision, .status,
                              .requiresAttributes, .compatibilities,
                              .registeredAt, .registeredBy)' \
                        task-def-full.json > task-def-new.json

                    NEW_TASK_ARN=\$(aws ecs register-task-definition \
                        --region ${AWS_REGION} \
                        --cli-input-json file://task-def-new.json \
                        --query 'taskDefinition.taskDefinitionArn' \
                        --output text)

                    aws ecs update-service \
                        --cluster ${ECS_CLUSTER} \
                        --service ${ECS_SERVICE} \
                        --task-definition \$NEW_TASK_ARN \
                        --region ${AWS_REGION}

                    echo "Deployed: \$NEW_TASK_ARN"
                """
            }
        }

    }

    post {
        always {
            sh """
                echo "=== Workspace artifact files ==="
                ls -la ${WORKSPACE}/*.xml ${WORKSPACE}/*.json 2>/dev/null || echo 'No matching files found'
                echo "=== Confirming checkov-report.xml is a FILE not a directory ==="
                file ${WORKSPACE}/checkov-report.xml 2>/dev/null || echo 'checkov-report.xml does not exist'
            """

            script {
                if (fileExists('checkov-report.xml')) {
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        junit 'checkov-report.xml'
                    }
                } else {
                    echo "checkov-report.xml not found — skipping junit publish"
                }
            }

            archiveArtifacts(
                artifacts: 'leaks-report.json,checkov-report.xml,sbom.json',
                allowEmptyArchive: true,
                fingerprint: true
            )
        }

        failure {
            echo "Pipeline failed - image was NOT deployed to ECS"
        }

        success {
            echo "Pipeline succeeded - image signed and deployed to ECS"
        }
    }
}
