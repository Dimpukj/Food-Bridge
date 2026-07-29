const nodemailer = require('nodemailer');
require('dotenv').config();

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify transporter is working
transporter.verify((error, success) => {
    if (error) {
        console.warn('⚠️  Email service not configured properly:', error.message);
        console.warn('   Set EMAIL_USER and EMAIL_PASSWORD in .env to enable notifications');
    } else {
        console.log('✓ Email service ready');
    }
});

/**
 * Send email for food request approval
 * @param {string} ngoEmail - NGO email
 * @param {string} ngoName - NGO name
 * @param {string} foodName - Food item name
 * @param {string} restaurantName - Restaurant name
 */
async function sendRequestApprovedEmail(ngoEmail, ngoName, foodName, restaurantName) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'foodbridge@noreply.com',
        to: ngoEmail,
        subject: '✅ Your Food Request Approved!',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">🎉 Request Approved!</h2>
                </div>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0 0 20px; font-size: 16px;">Hi ${ngoName},</p>
                    <p style="margin: 0 0 15px; font-size: 15px; color: #374151;">Your request for <strong>${foodName}</strong> from <strong>${restaurantName}</strong> has been <span style="color: #10b981; font-weight: bold;">approved!</span></p>
                    <p style="margin: 0 0 15px; font-size: 15px; color: #374151;">🚚 Prepare for pickup/delivery. Contact the restaurant for any details.</p>
                    <div style="background: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; font-size: 13px; color: #6b7280;"><strong>Next Step:</strong> Log in to FoodBridge and check delivery tracking for updates.</p>
                    </div>
                    <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">Thank you for supporting food waste reduction! 🌍</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Approval email sent to ${ngoEmail}`);
    } catch (error) {
        console.error(`✗ Failed to send approval email to ${ngoEmail}:`, error.message);
    }
}

/**
 * Send email for food request rejection
 */
async function sendRequestRejectedEmail(ngoEmail, ngoName, foodName, restaurantName) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'foodbridge@noreply.com',
        to: ngoEmail,
        subject: '❌ Your Food Request Status Update',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">Request Not Approved</h2>
                </div>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0 0 20px; font-size: 16px;">Hi ${ngoName},</p>
                    <p style="margin: 0 0 15px; font-size: 15px; color: #374151;">Unfortunately, your request for <strong>${foodName}</strong> from <strong>${restaurantName}</strong> was not approved at this time.</p>
                    <p style="margin: 0 0 15px; font-size: 15px; color: #374151;">💡 Don't worry! Keep browsing other available food items on FoodBridge.</p>
                    <a href="https://foodbridge-app.com/browse" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Browse More Food</a>
                    <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">Keep up the great work helping reduce food waste! 🌱</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Rejection email sent to ${ngoEmail}`);
    } catch (error) {
        console.error(`✗ Failed to send rejection email to ${ngoEmail}:`, error.message);
    }
}

/**
 * Send email when restaurant approves a request
 */
async function sendDeliveryUpdateEmail(ngoEmail, ngoName, foodName, restaurantName, status, deliveryAgent, agentPhone) {
    const statusMessages = {
        'in-transit': {
            title: '🚚 Your Food is On The Way!',
            message: `Your ${foodName} from ${restaurantName} is currently in transit.`,
            icon: '🚚'
        },
        'delivered': {
            title: '✅ Food Delivered Successfully!',
            message: `Your ${foodName} from ${restaurantName} has been delivered.`,
            icon: '✅'
        },
        'pending': {
            title: '📦 Delivery Preparation Started',
            message: `Your ${foodName} from ${restaurantName} is being prepared for delivery.`,
            icon: '📦'
        }
    };

    const statusInfo = statusMessages[status] || statusMessages['pending'];
    const agentInfo = deliveryAgent ? `<p style="margin: 10px 0; font-size: 14px;"><strong>Delivery Agent:</strong> ${deliveryAgent}</p>` : '';
    const agentPhoneInfo = agentPhone ? `<p style="margin: 10px 0; font-size: 14px;"><strong>Contact:</strong> ${agentPhone}</p>` : '';

    const mailOptions = {
        from: process.env.EMAIL_USER || 'foodbridge@noreply.com',
        to: ngoEmail,
        subject: `${statusInfo.icon} ${statusInfo.title}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">${statusInfo.icon} ${statusInfo.title}</h2>
                </div>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0 0 20px; font-size: 16px;">Hi ${ngoName},</p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">${statusInfo.message}</p>
                    <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #3b82f6;">
                        <p style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #1f2937;">📋 Delivery Details</p>
                        ${agentInfo}
                        ${agentPhoneInfo}
                        <p style="margin: 10px 0; font-size: 14px;"><strong>Food Item:</strong> ${foodName}</p>
                        <p style="margin: 10px 0; font-size: 14px;"><strong>From:</strong> ${restaurantName}</p>
                    </div>
                    <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">Check your FoodBridge dashboard for more details. Thank you! 🙏</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Delivery update email sent to ${ngoEmail}`);
    } catch (error) {
        console.error(`✗ Failed to send delivery email to ${ngoEmail}:`, error.message);
    }
}

/**
 * Send email to restaurants when they get a new request
 */
async function sendNewRequestNotificationEmail(restaurantEmail, restaurantName, ngoName, foodName, quantity) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'foodbridge@noreply.com',
        to: restaurantEmail,
        subject: '🤝 New Food Request from an NGO',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">🤝 New Request Alert!</h2>
                </div>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0 0 20px; font-size: 16px;">Hi ${restaurantName},</p>
                    <p style="margin: 0 0 15px; font-size: 15px; color: #374151;"><strong>${ngoName}</strong> has requested your <strong>${foodName}</strong> (${quantity}).</p>
                    <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #f97316;">
                        <p style="margin: 0 0 10px; font-size: 14px;"><strong>Action Required:</strong> Log in to FoodBridge and approve or reject this request.</p>
                        <p style="margin: 10px 0; font-size: 13px; color: #6b7280;">⏰ Please respond within 30 minutes to confirm availability.</p>
                    </div>
                    <a href="https://foodbridge-app.com/request-mgmt" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; margin: 20px 0;">Manage Requests</a>
                    <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">Every request helps reduce food waste! 🌍</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ New request notification sent to ${restaurantEmail}`);
    } catch (error) {
        console.error(`✗ Failed to send request notification to ${restaurantEmail}:`, error.message);
    }
}

/**
 * Send food listing confirmation to restaurant
 */
async function sendFoodListingConfirmationEmail(restaurantEmail, restaurantName, foodName, quantity, pickupBy) {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'foodbridge@noreply.com',
        to: restaurantEmail,
        subject: '✅ Food Listing Posted Successfully',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">✅ Food Listed!</h2>
                </div>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="margin: 0 0 20px; font-size: 16px;">Hi ${restaurantName},</p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Your food listing has been posted and is now visible to NGOs on FoodBridge.</p>
                    <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #10b981;">
                        <p style="margin: 0 0 10px; font-size: 14px; font-weight: bold;">📦 Listing Details</p>
                        <p style="margin: 10px 0; font-size: 14px;"><strong>Food:</strong> ${foodName}</p>
                        <p style="margin: 10px 0; font-size: 14px;"><strong>Quantity:</strong> ${quantity}</p>
                        <p style="margin: 10px 0; font-size: 14px;"><strong>Pickup By:</strong> ${new Date(pickupBy).toLocaleString()}</p>
                    </div>
                    <p style="margin: 20px 0 0; font-size: 15px; color: #374151;">💡 Tip: You'll receive notifications when NGOs request your food.</p>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af;">Thank you for reducing food waste! 🌱</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✓ Listing confirmation email sent to ${restaurantEmail}`);
    } catch (error) {
        console.error(`✗ Failed to send listing email to ${restaurantEmail}:`, error.message);
    }
}

module.exports = {
    sendRequestApprovedEmail,
    sendRequestRejectedEmail,
    sendDeliveryUpdateEmail,
    sendNewRequestNotificationEmail,
    sendFoodListingConfirmationEmail
};
