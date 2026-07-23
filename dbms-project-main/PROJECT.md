# FoodBridge – Food Waste Management System

## 📋 Project Overview

**FoodBridge** is a comprehensive web-based platform designed to bridge the critical gap between restaurants with surplus food and NGOs/charitable organizations that need food assistance. The system streamlines the entire process of connecting food donors (restaurants) with food receivers (NGOs), effectively reducing food waste while simultaneously addressing food security issues in communities.

### Mission
To create a transparent, efficient, and scalable food distribution network that:
- Eliminates food waste by connecting surplus food to those in need
- Provides real-time tracking and transparency in food donations
- Simplifies the donation process for restaurants
- Enables NGOs to source food efficiently and reliably
- Builds a community-driven approach to food security

---

## 🎯 Project Purpose & Objectives

### Primary Goals
1. **Reduce Food Waste**: Connect restaurants with surplus food to prevent it from being discarded
2. **Address Food Insecurity**: Provide reliable access to food for NGOs and communities in need
3. **Streamline Logistics**: Automate the coordination between donors and receivers
4. **Ensure Transparency**: Track food from donation to delivery with complete audit trails
5. **Scale Impact**: Create a platform that can grow to serve multiple cities and organizations

### Target Users
- **Restaurants/Food Donors**: Quick and easy way to donate surplus food
- **NGOs/Food Receivers**: Reliable access to food supplies with minimal overhead
- **Delivery Agents**: Simple coordination for food distribution
- **Administrators**: Complete oversight and audit capabilities

---

## 💻 Technology Stack

### Frontend
- **HTML5** - Semantic markup and structure
- **CSS3** - Tailwind CSS for responsive, utility-first styling
- **JavaScript (Vanilla)** - Client-side interactivity without frameworks
- **LocalStorage** - Client-side session and user data persistence

### Backend
- **Runtime**: Node.js (JavaScript runtime)
- **Framework**: Express.js v5.2.1 (lightweight, flexible web framework)
- **Authentication**: JWT (JSON Web Tokens) with jsonwebtoken v9.0.3
- **Password Security**: bcryptjs v3.0.3 (password hashing and verification)
- **Email Service**: Nodemailer v8.0.7 (email notifications)
- **Database Driver**: mysql2 v3.22.0 (MySQL database connectivity)
- **CORS**: cors v2.8.6 (Cross-Origin Resource Sharing)
- **Environment Config**: dotenv v17.4.2 (environment variable management)

### Database
- **DBMS**: MySQL (relational database)
- **Architecture**: Connection pooling for performance optimization
- **SSL Support**: Encrypted connections for remote/cloud databases
- **Keep-Alive**: Automatic ping mechanism to prevent connection timeouts on free tier

### Deployment
- **Platform**: Vercel (serverless functions)
- **API Handler**: `/api/index.js` exports Express app as Vercel handler
- **Static Files**: Served from project root
- **Port**: 3000 (development), environment-configurable for production

### Quality & Accessibility
- **Accessibility Testing**: Axe Core CLI integration for WCAG compliance checks

---

## 🚀 Key Features

### For Restaurants (Food Donors)

#### Account Management
- Register with restaurant name, location, contact, and email
- Secure login with JWT authentication
- Update profile information
- View donation history and statistics

#### Food Listing Management
- **Create Listings**: Add surplus food with:
  - Food name and description
  - Quantity (flexible units)
  - Expiry date and time
  - Food category (Produce, Dairy, Bakery, Cooked, etc.)
  - Automatic creation timestamp
- **View Listings**: Browse all posted food items with real-time status
- **Update Listings**: Modify details before requests are received
- **Status Tracking**: Monitor food status through lifecycle:
  - `Available` → `Requested` → `Allocated` → `Expired`

#### Request Management
- **View Requests**: See all incoming requests from NGOs
- **Approve/Reject**: Accept or deny requests with optional remarks
- **Batch Operations**: Handle multiple requests efficiently
- **Request History**: View past requests and approvals

#### Delivery Coordination
- **Real-time Tracking**: Monitor delivery status (Pending → In Transit → Delivered)
- **Delivery Agent Info**: See assigned delivery agent and contact
- **Delivery Time**: Confirm and track actual delivery times
- **Notifications**: Receive email alerts on status changes

### For NGOs (Food Receivers)

#### Account Management
- Register with NGO name, location, contact, and email
- Secure login and profile management
- View donation statistics and impact metrics

#### Food Browsing & Requests
- **Browse Listings**: Search and filter available food items
- **Advanced Filtering**: Filter by:
  - Category
  - Expiry time (freshness)
  - Quantity needed
  - Location of donor
- **Request Submission**: Submit detailed requests with remarks
- **Request History**: View all past requests and status

#### Request Tracking
- **Status Visibility**: Track request through workflow:
  - `Pending` → `Approved` → `Rejected`
  - Includes remarks from donor
- **Delivery Integration**: Link requests to delivery schedules
- **Notifications**: Email alerts on approvals, rejections, and deliveries

#### Impact Dashboard
- **Statistics**: Total food received, weight, categories
- **Beneficiary Tracking**: Monitor aid to communities
- **Delivery Schedule**: View upcoming deliveries

### System-Wide Features

#### Authentication & Security
- **JWT Tokens**: Stateless, secure session management
- **Password Hashing**: Bcryptjs with salt rounds
- **Login Sessions**: Persistent user context via LocalStorage
- **Token Expiration**: Automatic session timeout for security

#### Real-Time Status Management
- **Food Status Lifecycle**: Available → Requested → Allocated → Expired
- **Request Status Workflow**: Pending → Approved/Rejected
- **Delivery Progress**: Pending → In Transit → Delivered → Reviewed
- **Automatic Updates**: Status changes reflected across all connected users

#### Notifications
- **Email Alerts**: Automatic emails for:
  - New requests received (restaurant)
  - Request approved/rejected (NGO)
  - Delivery dispatch notification
  - Delivery completed confirmation
- **In-App Notifications**: Real-time UI updates

#### Audit & Compliance
- **Audit Logging**: All transactions logged with timestamp
- **Change Tracking**: Record who made what change and when
- **Delivery Proof**: Delivery agent signatures and photos
- **Remarks**: Optional notes on each request/approval

#### Accessibility
- **WCAG Compliance**: Built with accessibility in mind
- **Color Badges**: Status badges with semantic colors:
  - Green: Approved/Available/Delivered
  - Amber: Pending
  - Blue: In Transit/Allocated
  - Red: Expired/Rejected
- **Responsive Design**: Mobile and desktop optimization

---

## 🗄️ Database Schema

### Overview
- **5 Core Tables**: Restaurant, NGO, Food_Listing, Request, Delivery
- **2 Auxiliary Tables**: Review, Audit_Log
- **Total Extra Columns**: 2 per core table for enhanced functionality
- **Relationships**: Carefully designed 1:M and 1:1 relationships with CASCADE deletes

### Table Specifications

#### 1. Restaurant (Food Donors)
```
restaurant_id     INT (PK, Auto-increment)
name              VARCHAR(150) - Not null
location          VARCHAR(300) - Not null
contact           VARCHAR(15)  - Phone number
email             VARCHAR(100) - Unique identifier
password          VARCHAR(255) - Hashed password
```
- **Primary Key**: restaurant_id
- **Unique Index**: email
- **Purpose**: Store restaurant/donor information
- **Relationships**: 1 Restaurant → M Food_Listings

#### 2. NGO (Food Receivers)
```
ngo_id            INT (PK, Auto-increment)
name              VARCHAR(150) - Organization name
location          VARCHAR(300) - Not null
contact           VARCHAR(15)  - Phone number
email             VARCHAR(100) - Unique identifier
password          VARCHAR(255) - Hashed password
```
- **Primary Key**: ngo_id
- **Unique Index**: email
- **Purpose**: Store NGO/receiver information
- **Relationships**: 1 NGO → M Requests

#### 3. Food_Listing (Surplus Food Inventory)
```
food_id           INT (PK, Auto-increment)
restaurant_id     INT (FK) - Links to Restaurant
food_name         VARCHAR(200) - Item description
quantity          VARCHAR(50)  - Flexible unit format
expiry_time       DATETIME     - Expiry deadline
status            ENUM - 'Available', 'Requested', 'Allocated', 'Expired'
category          VARCHAR(50)  - Food type (extra field)
created_at        TIMESTAMP    - Auto-set creation time (extra field)
```
- **Primary Key**: food_id
- **Foreign Key**: restaurant_id → Restaurant.restaurant_id (CASCADE)
- **Indexes**: restaurant_id, status, expiry_time
- **Purpose**: Track available surplus food inventory
- **Relationships**: 1 Food_Listing → M Requests

#### 4. Request (NGO Food Requests)
```
request_id        INT (PK, Auto-increment)
ngo_id            INT (FK) - Links to NGO
food_id           INT (FK) - Links to Food_Listing
request_time      TIMESTAMP    - Auto-set request timestamp
status            ENUM - 'Pending', 'Approved', 'Rejected'
remarks           TEXT         - Restaurant approval remarks (extra field)
updated_at        TIMESTAMP    - Auto-update on status change (extra field)
```
- **Primary Keys**: request_id
- **Foreign Keys**: ngo_id → NGO.ngo_id (CASCADE), food_id → Food_Listing.food_id (CASCADE)
- **Indexes**: ngo_id, food_id, status
- **Purpose**: Track NGO requests for food
- **Relationships**: M Requests → 1 Delivery (1:1)

#### 5. Delivery (Fulfillment Tracking)
```
delivery_id       INT (PK, Auto-increment)
request_id        INT (FK, UNIQUE) - Links to Request (1:1)
delivery_status   ENUM - 'Pending', 'In Transit', 'Delivered', 'Cancelled'
delivery_time     DATETIME     - Actual delivery timestamp
delivery_agent    VARCHAR(100) - Agent name (extra field)
agent_phone       VARCHAR(15)  - Agent contact (extra field)
```
- **Primary Key**: delivery_id
- **Foreign Key**: request_id → Request.request_id (CASCADE, UNIQUE for 1:1)
- **Indexes**: request_id, delivery_status
- **Purpose**: Track physical food delivery logistics
- **Relationships**: 1 Delivery ← 1:1 → Request

#### Additional Tables

**Review Table**
- Customer/recipient reviews of received food
- Ratings and feedback mechanism
- Links to Delivery records

**Audit_Log Table**
- Complete audit trail of all system changes
- Tracks user actions with timestamp
- Records before/after states for compliance

### Data Relationships Diagram
```
Restaurant (1) ──→ (M) Food_Listing
                         │
                         ↓ (M)
                    Request (1:1) ──→ Delivery
                         ↑
NGO (1) ──→ (M) ────────┘
```

---

## 🔌 API Architecture

### Base URL
- Development: `http://localhost:3000`
- Production: Deployed via Vercel serverless functions

### Authentication
All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

### Endpoint Categories

#### Authentication Endpoints
- `POST /auth/register` - Register new restaurant or NGO
- `POST /auth/login` - Login and receive JWT token
- `POST /auth/logout` - Logout and invalidate session
- `POST /auth/refresh` - Refresh JWT token

#### Restaurant Endpoints
- `GET /restaurants/:id` - Get restaurant profile
- `PUT /restaurants/:id` - Update restaurant info
- `POST /restaurants/:id/listings` - Create food listing
- `GET /restaurants/:id/listings` - Get all restaurant's listings
- `GET /restaurants/:id/requests` - Get incoming requests
- `PUT /restaurants/:id/requests/:requestId/approve` - Approve request
- `PUT /restaurants/:id/requests/:requestId/reject` - Reject request
- `GET /restaurants/:id/deliveries` - View deliveries

#### NGO Endpoints
- `GET /ngos/:id` - Get NGO profile
- `PUT /ngos/:id` - Update NGO info
- `GET /ngos/:id/requests` - Get NGO's requests
- `POST /ngos/:id/requests` - Submit new request
- `GET /ngos/:id/deliveries` - Get delivery status
- `POST /ngos/:id/reviews` - Leave review for delivery

#### Food Listing Endpoints
- `GET /listings` - Browse all available food (with filters)
- `GET /listings/:id` - Get specific listing details
- `GET /listings/search?q=&category=&expiry=` - Advanced search
- `GET /listings/by-restaurant/:restaurantId` - Get restaurant's listings

#### Request Endpoints
- `GET /requests/:id` - Get request details
- `GET /requests?status=pending` - Get requests by status
- `PUT /requests/:id/status` - Update request status

#### Delivery Endpoints
- `GET /deliveries/:id` - Get delivery details
- `PUT /deliveries/:id/status` - Update delivery status
- `POST /deliveries/:id/track` - Real-time tracking

#### Admin/Audit Endpoints
- `GET /audit-logs` - Get audit trail
- `GET /reports/food-waste` - Food waste statistics
- `GET /reports/impact` - Impact metrics

### Request/Response Format

#### Standard Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Server Error

---

## 🔄 Core Workflows

### Workflow 1: Food Donation Flow

**Scenario**: Restaurant has leftover food at end of day

```
Step 1: Restaurant Login
  ↓
Step 2: Create Food Listing
  - Enter food details (name, qty, expiry, category)
  - System auto-timestamps and sets status to "Available"
  - Email confirmation sent
  ↓
Step 3: NGO Browses Listings
  - NGO searches by category, location, expiry time
  - Views listing details and donor restaurant info
  ↓
Step 4: NGO Submits Request
  - NGO selects quantity needed
  - Optional remarks about specific needs
  - System sets request status to "Pending"
  - Restaurant receives email notification
  ↓
Step 5: Restaurant Reviews & Acts
  - Restaurant sees request dashboard
  - Reviews NGO information and quantity
  - Approves (status → "Approved") or Rejects (status → "Rejected")
  - Optional remarks sent to NGO
  - Food listing status → "Allocated" (if approved)
  ↓
Step 6: Delivery Dispatch
  - System creates Delivery record
  - Assigns delivery agent (if applicable)
  - Status → "Pending"
  - Both parties receive notifications
  ↓
Step 7: Delivery Execution
  - Delivery agent picks up food from restaurant
  - Delivery status → "In Transit"
  - Both parties can track progress
  ↓
Step 8: Delivery Completion
  - Agent delivers food to NGO
  - Delivery status → "Delivered"
  - Delivery timestamp recorded
  - Confirmation email sent
  ↓
Step 9: Post-Delivery
  - NGO can leave review/rating
  - Food listing status → "Completed"
  - Impact metrics updated
```

### Workflow 2: Request Management

**Status Transitions**
```
PENDING ─────────→ APPROVED ─────────→ DELIVERY IN-PROGRESS
  │
  └──────────────→ REJECTED ─────────→ NOTIFICATION SENT
```

- **Pending Phase**: Request submitted, awaiting restaurant response (24-48 hours typical)
- **Approval Phase**: Restaurant approves, delivery scheduled
- **Rejection Phase**: Restaurant declines with remarks, request can be resubmitted

### Workflow 3: Delivery Tracking

**Real-Time Updates**
```
PENDING (Dispatch Arranged)
  ↓ [Agent En Route]
IN_TRANSIT (Agent has picked up)
  ↓ [Delivery In Progress]
DELIVERED (Arrived at NGO)
  ↓ [Confirmed Receipt]
COMPLETED (Review Available)
```

**Tracking Features**:
- Agent contact information visible
- Estimated delivery time
- Last update timestamp
- Status change notifications

---

## 🛡️ Security Measures

### Authentication & Authorization
- **JWT Token-Based**: Stateless, scalable authentication
- **Token Expiry**: Automatic session timeout (configurable, default 24 hours)
- **Refresh Tokens**: Extend sessions without re-login
- **Role-Based Access Control**: Different routes for restaurants vs NGOs

### Password Security
- **Bcryptjs Hashing**: Industry-standard password hashing with salt rounds
- **Minimum Requirements**: Enforced password complexity
- **No Plaintext Storage**: Passwords never stored in plain text
- **Password Reset**: Secure email-based password recovery

### Database Security
- **Connection Pooling**: Limit concurrent connections
- **SSL/TLS**: Encrypted connections for remote databases
- **SQL Injection Prevention**: Parameterized queries throughout
- **Keep-Alive Mechanism**: Prevents stale connection timeouts

### API Security
- **CORS Protection**: Whitelist allowed origins
- **Rate Limiting**: Prevent brute force attacks
- **Input Validation**: Sanitize and validate all user inputs
- **Output Encoding**: Prevent XSS attacks

### Data Privacy
- **Environment Variables**: Sensitive data (DB credentials, keys) externalized
- **Audit Logging**: Complete trail of all transactions
- **Data Retention Policies**: Define how long data is stored
- **GDPR Compliance**: Support for data deletion requests

### Infrastructure Security
- **Vercel Deployment**: Managed security and DDoS protection
- **Environment Isolation**: Development, staging, production separation
- **Secrets Management**: Secure handling of API keys and credentials
- **Regular Updates**: Keep dependencies patched for vulnerabilities

---

## 📁 Project Structure

```
food-bridge/
├── app.js                 # Frontend application logic (UI interactions, DOM manipulation)
├── server.js              # Backend Express server setup and database configuration
├── index.html             # Main HTML template (single-page app)
├── database.sql           # MySQL schema definition with all tables
├── package.json           # Node.js dependencies and metadata
├── .env                   # Environment variables (DB config, secrets)
├── .gitignore             # Git ignore rules
├── emailService.js        # Nodemailer email handling
│
├── api/
│   └── index.js           # Vercel serverless function handler
│
└── public/                # (Optional) Static assets
    ├── images/
    ├── css/
    └── js/
```

### File Descriptions

**app.js**
- Client-side JavaScript
- DOM manipulation and UI interactions
- User session management with localStorage
- Request/response handling
- Real-time UI updates
- Status badge rendering

**server.js**
- Express.js server configuration
- MySQL connection pool setup
- Middleware setup (CORS, JSON parser)
- Keep-alive database ping mechanism
- API route definitions
- Authentication middleware
- Error handling

**index.html**
- Single-page application structure
- Responsive layout using Tailwind CSS
- Dashboard UI for restaurants and NGOs
- Modal dialogs for forms
- Real-time status displays
- Food listing and request tables

**database.sql**
- Complete MySQL schema
- Table definitions with constraints
- Indexes for performance
- Foreign key relationships
- Default values and enums
- Setup and teardown scripts

**package.json**
- Node.js project metadata
- npm package dependencies
- Scripts for development/testing
- npm scripts: `npm start`, `npm test`
- Accessibility testing: `npm run axe`

**.env**
- Database host, user, password, name, port
- JWT secret key
- Email service credentials
- Port configuration
- Environment-specific settings

**emailService.js**
- Nodemailer SMTP configuration
- Email template formatting
- Send email functions for events
- Retry logic for failed sends

**api/index.js**
- Vercel serverless function wrapper
- Exports Express app as handler
- Enables deployment to Vercel

---

## 🚀 Getting Started

### Prerequisites
- Node.js v16+ and npm/yarn
- MySQL v5.7+ or cloud database (e.g., AWS RDS, PlanetScale)
- Environment variables configured

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd food-bridge
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Initialize Database**
   ```bash
   mysql -u root -p < database.sql
   ```

5. **Start Development Server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3000`

6. **Verify Installation**
   - Open browser to `http://localhost:3000`
   - Register test account
   - Test basic workflows

### Development Commands
```bash
npm start           # Start development server
npm test            # Run tests
npm run axe         # Run accessibility audit
npm run build       # Build for production
npm run deploy      # Deploy to Vercel
```

---

## 📊 Key Metrics & KPIs

### Impact Metrics
- **Food Saved**: Total weight/quantity of food redistributed
- **Meals Provided**: Estimated meals from distributed food
- **Food Waste Reduced**: Percentage of surplus food diverted from waste
- **Cost Savings**: Estimated value of food donated

### Performance Metrics
- **Request Fulfillment Rate**: % of requests approved
- **Average Response Time**: Time from request to approval
- **Delivery Success Rate**: % of approved requests successfully delivered
- **System Uptime**: Platform availability percentage

### User Metrics
- **Active Restaurants**: Number of registered and active donors
- **Active NGOs**: Number of registered and active receivers
- **Monthly Listings**: New food listings posted
- **Monthly Requests**: Requests submitted by NGOs

---

## 🐛 Known Issues & Limitations

- Single-page app may require page refresh for certain bulk operations
- Email delivery depends on SMTP server availability
- Free-tier database connections timeout after 30 minutes (keep-alive mechanism included)
- Real-time tracking requires periodic polling (consider WebSocket upgrade)
- Review system is placeholder (not fully implemented)

---

## 🔮 Future Enhancements

### Phase 2
- WebSocket integration for real-time notifications
- Mobile app for restaurants and NGOs
- SMS notifications for delivery alerts
- Advanced analytics and reporting dashboard
- Food category AI-powered suggestions

### Phase 3
- Integration with food delivery partners
- AI-powered demand forecasting
- Carbon footprint tracking
- Blockchain-based transparency layer
- Loyalty/rewards program

### Phase 4
- Multi-language support
- International expansion features
- API for third-party integrations
- White-label solution for cities/regions

---

## 📞 Support & Contribution

### Reporting Issues
- Create GitHub issues with detailed descriptions
- Include steps to reproduce
- Attach screenshots/logs

### Contributing
- Fork repository
- Create feature branch
- Submit pull requests with tests
- Follow code style guidelines

### Contact
- Email: support@foodbridge.local
- GitHub: [project-repo-url]

---

## 📄 License & Compliance

- **License**: ISC
- **GDPR**: Compliant with data protection requirements
- **Accessibility**: WCAG 2.1 Level AA target
- **Data Retention**: Per privacy policy
- **Audit Requirements**: Complete audit logs maintained

---

## 🎓 Additional Resources

### Database Documentation
See `database.sql` for complete schema with comments and relationships.

### API Documentation
API endpoints documented in `/api/index.js` with JSDoc comments.

### Accessibility Testing
Run Axe Core audit: `npm run axe`
Reports saved to `axe-report.html`

### Environment Setup
Refer to `.env.example` for all configurable parameters.

---

**Last Updated**: May 2026
**Version**: 1.0.0
**Status**: Active Development
