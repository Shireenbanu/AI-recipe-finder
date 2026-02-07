<img width="807" height="540" alt="Screenshot 2026-02-06 at 6 17 33 PM" src="https://github.com/user-attachments/assets/95ae6852-7c09-4d79-aa26-148eb5916770" /></br>


**Application Overview**

This application helps users manage their health by securely storing medical history, lab reports, and personal profile information. Based on a patient’s conditions, it generates personalized healthy recipes using a recommendation engine integrated with the Gemini API. The goal is to provide actionable nutrition guidance while maintaining HIPAA compliance, data privacy, and secure storage. It also caches generated recipes for quick retrieval and seamless user experience.


### Configuring Route 53 Records (DNS Setup)
<img width="1544" height="88" alt="image" src="https://github.com/user-attachments/assets/423ef2ea-ac69-4d46-bbef-fa686f13b6dc" />

Below is a checklist of items to verify after running the Terraform / AWS setup.

 1) Verify Hosted Zone Creation
When Route 53 creates a Hosted Zone, it automatically includes:

- **NS Record (Name Servers)**
- **SOA Record (Start of Authority)**

The **NS record** will contain multiple AWS name servers that look like:

<img width="458" height="194" alt="image" src="https://github.com/user-attachments/assets/c8225cdf-a379-4d9f-a85e-535c745538e5" />


These are the name servers that must be mapped in your domain registrar (example: Namecheap).  
When someone queries `shireenlabs.me`, the DNS resolution will eventually route to these name servers because AWS becomes the authoritative DNS provider.



2) Update Namecheap (or your domain registrar)
Copy the Route 53 **NS record values** and paste them into your domain registrar.

This ensures that the top-level DNS authorities know that **AWS Route 53 is the authoritative DNS server** for your domain.



3) Domain Validation (ACM)
I opted for **Domain Validation** using AWS ACM.

This process can take some time. AWS typically mentions it may take up to **48 hours** to propagate, but in my case it completed in about **21 minutes**.


4) Confirm DNS Propagation
To confirm the DNS mapping is complete, run:

```bash
dig shireenlabs.me NS
```
<img width="582" height="463" alt="Screenshot 2026-01-26 at 1 45 06 PM" src="https://github.com/user-attachments/assets/12c26654-40fa-4c92-9a15-932d5d29f9e4" />


5) Create an A Record (Alias)

Once the hosted zone is active, ensure you have an A record configured.

This record should point to your ALB (Application Load Balancer) or whichever server should receive the traffic.

### Cost Note (Route 53)
Route 53 charges **$0.50/month per public hosted zone** (for the first 25 hosted zones). DNS queries are billed separately, but for a low-traffic personal project the query cost is typically minimal. honeslty, I have not incured any charge for this service.


### Authentication:
<img width="582" height="463" alt="image" src="https://github.com/user-attachments/assets/f122df3a-ff80-425f-b54e-35a62704c3a4" />

## Authentication (AWS Cognito)

I configured AWS Cognito manually through the AWS Console since this was my first time working with Cognito and I wanted to understand the setup end-to-end before automating it.

Key configuration points:
- Configured **password policy** in the User Pool
- Made **email mandatory** as the primary sign-in identifier
- Enabled **email verification** to verify users during sign-up

After setup, I copied the required identifiers:
- `userPoolId`
- `userPoolClientId` (Client ID)

In the backend, I integrated authentication using:
- `aws-amplify/auth`

This handles sign-up, sign-in, and email verification flows.

Below is the screenshot of the email verification email received from aws cognito integration.
<img width="582" height="463" alt="image" src="https://github.com/user-attachments/assets/de837439-f729-4550-85a6-6930c5201460" />

### Recipe Recommendation Engine Using Gemini LLM

<img width="582" height="463" alt="image" src="https://github.com/user-attachments/assets/20145932-4eea-436d-bc9a-afc5c7b6c622" />

The recommendation engine generates personalized healthy recipes based on **either a user-uploaded lab report or selected medical conditions**.  

**Key Points:**
- Lab reports undergo **hygiene checks** (file size ≤ 10MB, allowed file types).  
- Users can select from a **predefined list of medical conditions**, which are converted into a prompt for the Gemini API.  
- **PHI minimization:** Only essential information (condition names, nutrient requirements) is sent to the LLM.  

**Example of prompt generation and API call:**

```javascript
// 1. TOKEN MINIMIZATION: Clean data before sending to Gemini
const compactConditions = conditions.map(c => c.name).join(',');
const compactNutrients = JSON.stringify(nutritionalNeeds);

// Short, instruction-heavy prompt to minimize tokens
const prompt = `JSON ONLY. Array of ${count} recipes for conditions: ${compactConditions}. Nutrients: ${compactNutrients}. Schema: {title,ingredients[],instructions[],nutritional_info:{calories,protein}}`;

for (const modelName of MODELS) {
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { 
        responseMimeType: "application/json",
        maxOutputTokens: 4000 // Limit output to reduce latency & cost
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const recipes = JSON.parse(response.text());
    console.log(recipes)
```
Performance & Caching:

Gemini API calls are the slowest due to free tier limits and recipe generation time.
Caching implemented: recipes for the same medical condition are stored in RDS, so repeated requests do not hit Gemini again.
Lab reports are not parsed to avoid highly user-specific prompts that cannot be cached efficiently.
Current setup: 1 Gemini call per unique medical condition in the database.

Security & PHI handling:
Lab reports are stored in a private S3 bucket.
Users can access their reports via presigned URLs valid for 30 minutes only.
Minimal PHI is sent to the LLM, ensuring privacy and compliance.

### Monitoring: Latency Analysis with Grafana

Below is a screenshot of the Grafana dashboard I set up to monitor **p99 latencies** for the application.  

<img width="1308" height="660" alt="image" src="https://github.com/user-attachments/assets/5430fab5-008d-4353-8dbb-2a73275cf91a" />

**Observations:**
- The **Gemini API** has the highest latency, with p99 measured at **3854 ms**.  
- Other services (S3 downloads, S3 uploads, RDS queries) show significantly lower latency.  
- This highlights why **caching Gemini responses** for repeated conditions is critical to improve responsiveness and reduce API costs.


