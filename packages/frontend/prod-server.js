import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || '3000');

const HOST_PORT = process.env.HOST_PORT || undefined;

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));

// Enable gzip compression
app.use(compression());

const PLATFORM_TO_HUBSPOT = {
    'X/Twitter': 'x_twitter',
    Youtube: 'youtube',
    Telegram: 'telegram',
    Discord: 'discord',
    Facebook: 'facebook',
    Instagram: 'instagram',
    Tiktok: 'tiktok',
    Twitch: 'twitch',
    Linkedin: 'linkedin',
    'Weibo (微博)': 'weibo',
    'WeChat (微信)': 'wechat',
    'Xiaohongshu (小红书)': 'xiaohongshu',
    'Douyin (抖音)': 'douyin',
    KakaoTalk: 'kakaotalk',
    Line: 'line',
    VK: 'vk',
    Odnoklassniki: 'odnoklassniki',
    Rutube: 'rutube',
    Other: 'others',
};

const IM_TO_HUBSPOT = {
    Telegram: 'im___telegram',
    WhatsApp: 'hs_whatsapp_phone_number',
    WeChat: 'im___wechat',
    QQ: 'im___qq',
    KakaoTalk: 'im___kakaotalk',
    LINE: 'im___line',
};

const LANGUAGE_TO_CODE = {
    Afrikaans: 'af',
    Albanian: 'sq',
    Arabic: 'ar',
    Armenian: 'hy',
    Assamese: 'as',
    Azerbaijani: 'az',
    Basque: 'eu',
    Belarusian: 'be',
    Bengali: 'bn',
    Bosnian: 'ba',
    Bulgarian: 'bg',
    Burmese: 'my',
    Catalan: 'ca',
    'Chinese (Simplified)': 'zh-chs',
    'Chinese (Traditional)': 'zh-cht',
    Croatian: 'hr',
    Czech: 'cs',
    Danish: 'da',
    Dutch: 'nl',
    English: 'en',
    Estonian: 'et',
    Faroese: 'fo',
    Farsi: 'fa',
    Finnish: 'fi',
    French: 'fr',
    Galician: 'gl',
    Georgian: 'ka',
    German: 'de',
    Greek: 'el',
    Gujarati: 'gu',
    'Haitian Creole': 'ht',
    Hausa: 'ha',
    Hebrew: 'he',
    Hindi: 'hi',
    Hungarian: 'hu',
    Icelandic: 'is',
    Indonesian: 'id',
    Irish: 'ga',
    Italian: 'it',
    Japanese: 'ja',
    Kannada: 'kn',
    Kazakh: 'kk',
    Kinyarwanda: 'rw',
    Kiswahili: 'ki',
    Konkani: 'ok',
    Korean: 'ko',
    Kurdish: 'ku',
    Kyrgyz: 'ky',
    Lao: 'lo',
    Latvian: 'lv',
    Lithuanian: 'lt',
    Macedonian: 'mk',
    Malagasy: 'mg',
    Malay: 'ms',
    Malayalam: 'm1',
    Maltese: 'mt',
    Marathi: 'mr',
    Mongolian: 'mn',
    Norwegian: 'no',
    'Norwegian Bokmal': 'nb',
    Nyanja: 'ny',
    Polish: 'pl',
    Portuguese: 'pt',
    Punjabi: 'pa',
    Romanian: 'ro',
    Russian: 'ru',
    Sanskrit: 'sa',
    Serbian: 'sr',
    Slovak: 'sk',
    Slovenian: 'sl',
    Spanish: 'es',
    Swahili: 'sw',
    Swedish: 'sv',
    Syriac: 'sy',
    Tagalog: 't1',
    Tamil: 'ta',
    Tatar: 'tt',
    Telugu: 'te',
    Thai: 'th',
    Turkish: 'tr',
    Ukrainian: 'uk',
    Urdu: 'ur',
    Uzbek: 'uz',
    Vietnamese: 'vi',
    Yoruba: 'yo',
};

const PLATFORM_TO_HUBSPOT_CHANNEL = {
    'X/Twitter': 'X/Twitter',
    Youtube: 'YouTube',
    Telegram: 'Telegram',
    Discord: 'Discord',
    Facebook: 'Facebook',
    Instagram: 'Instagram',
    Tiktok: 'TikTok',
    Twitch: 'Twitch',
    Linkedin: 'LinkedIn',
    'Weibo (微博)': 'Weibo',
    'WeChat (微信)': 'WeChat',
    'Xiaohongshu (小红书)': 'Xiaohongshu',
    'Douyin (抖音)': 'Douyin',
    KakaoTalk: 'KakaoTalk',
    Line: 'LINE',
    VK: 'VK',
    Odnoklassniki: 'Odnoklassniki',
    Rutube: 'Rutube',
    Other: 'Others',
};

const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const HUBSPOT_OBJECT_IDS = { SOCIAL_CHANNEL: '2-196061099', DEAL: 'deals' };
const HUBSPOT_ASSOCIATION_TYPES = {
    CONTACT_TO_SOCIAL_CHANNEL: 18,
    CONTACT_TO_DEAL: 4,
};
const LIFECYCLE_STAGES = { WAITING_FOR_CONTACT: '3688247493' };

async function hubspotRequest(endpoint, method, body, token) {
    const response = await fetch(`${HUBSPOT_API_BASE}${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        let parsed = {};
        try {
            parsed = JSON.parse(errorText);
        } catch {
            //
        }
        const err = new Error(parsed.message || 'HubSpot API request failed');
        err.status = response.status;
        err.category = parsed.category || 'UNKNOWN';
        err.details = errorText;
        err.errors = parsed.errors || [];
        throw err;
    }

    return response.json();
}

function mapFormToContactProperties(body) {
    const properties = {
        email: body.email,
        firstname: body.firstName,
        lastname: body.lastName,
        phone: body.phone,
        instant_messenger: body.im,
        social_identity_name: body.socialName,
        wallet_address: body.walletAddress,
        lifecyclestage: LIFECYCLE_STAGES.WAITING_FOR_CONTACT,
        referral_update_request: body.upgradeRequest,
    };

    if (body.recommenderName) {
        properties.recommender_name = body.recommenderName;
    }
    if (body.recommenderEmail) {
        properties.recommender_email = body.recommenderEmail;
    }
    if (body.affiliateAgreement !== undefined) {
        properties.affiliate_agreement = body.affiliateAgreement;
    }

    const imProperty = IM_TO_HUBSPOT[body.im];
    if (imProperty) {
        properties[imProperty] = body.imHandle;
    } else {
        properties.im___others = body.imHandle;
    }

    if (body.im === 'WhatsApp') {
        properties.hs_whatsapp_phone_number = body.phone;
    }

    return properties;
}

function mapFormToSocialChannelProperties(channel, socialName) {
    const platform =
        PLATFORM_TO_HUBSPOT_CHANNEL[channel.platform] || channel.platform;
    const langCode =
        LANGUAGE_TO_CODE[channel.language] ||
        String(channel.language || '').toLowerCase();
    const followersNum = parseInt(channel.followers, 10);

    return {
        social_channel_name: `${channel.platform} - @${socialName}`,
        social_channels: platform,
        channel_followerssubscribers: Number.isNaN(followersNum)
            ? 0
            : followersNum,
        channel_language: langCode,
    };
}

function mapFormToDealProperties(body) {
    return {
        dealname: `Affiliate - ${body.email}`,
        product: 'Ambient',
        wallet_address: body.walletAddress,
        wallet_connected: 'Yes',
        affiliate_agreement: body.affiliateAgreement ? 'true' : 'false',
    };
}

app.post('/api/hubspot', async (req, res) => {
    const partialSuccess = {};

    try {
        const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
        if (!hubspotToken) {
            return res
                .status(500)
                .json({ error: 'HubSpot configuration missing' });
        }

        const body = req.body || {};

        const contactProps = mapFormToContactProperties(body);
        const contact = await hubspotRequest(
            '/crm/v3/objects/contacts',
            'POST',
            { properties: contactProps },
            hubspotToken,
        );
        partialSuccess.contactId = contact.id;

        const socialChannels = Array.isArray(body.socialChannels)
            ? body.socialChannels
            : [];
        const socialChannelIds = [];
        for (const channel of socialChannels) {
            const props = mapFormToSocialChannelProperties(
                channel,
                body.socialName,
            );
            const result = await hubspotRequest(
                `/crm/v3/objects/${HUBSPOT_OBJECT_IDS.SOCIAL_CHANNEL}`,
                'POST',
                { properties: props },
                hubspotToken,
            );
            socialChannelIds.push(result.id);
        }
        partialSuccess.socialChannelIds = socialChannelIds;

        if (socialChannelIds.length > 0) {
            await hubspotRequest(
                `/crm/v4/associations/contacts/${HUBSPOT_OBJECT_IDS.SOCIAL_CHANNEL}/batch/create`,
                'POST',
                {
                    inputs: socialChannelIds.map((scId) => ({
                        from: { id: contact.id },
                        to: { id: scId },
                        types: [
                            {
                                associationCategory: 'USER_DEFINED',
                                associationTypeId:
                                    HUBSPOT_ASSOCIATION_TYPES.CONTACT_TO_SOCIAL_CHANNEL,
                            },
                        ],
                    })),
                },
                hubspotToken,
            );
        }

        const dealProps = mapFormToDealProperties(body);
        const deal = await hubspotRequest(
            '/crm/v3/objects/deals',
            'POST',
            { properties: dealProps },
            hubspotToken,
        );
        partialSuccess.dealId = deal.id;

        await hubspotRequest(
            `/crm/v4/associations/contacts/${HUBSPOT_OBJECT_IDS.DEAL}/batch/create`,
            'POST',
            {
                inputs: [
                    {
                        from: { id: contact.id },
                        to: { id: deal.id },
                        types: [
                            {
                                associationCategory: 'HUBSPOT_DEFINED',
                                associationTypeId:
                                    HUBSPOT_ASSOCIATION_TYPES.CONTACT_TO_DEAL,
                            },
                        ],
                    },
                ],
            },
            hubspotToken,
        );

        return res.status(200).json({
            success: true,
            message: 'Affiliate application created successfully',
            data: {
                contactId: contact.id,
                socialChannelIds,
                dealId: deal.id,
            },
        });
    } catch (error) {
        const fieldErrors = {};
        let errorCode = error.category || 'UNKNOWN';
        let errorMessage =
            error.message || 'Failed to create affiliate application';

        if (
            errorCode === 'CONFLICT' &&
            error.message?.includes('Contact already exists')
        ) {
            errorMessage =
                'This email is already registered. Please use a different email address.';
            fieldErrors.email = errorMessage;
        } else if (errorCode === 'VALIDATION_ERROR' && error.errors?.length) {
            errorMessage =
                'Invalid data provided. Please check your information and try again.';
            for (const err of error.errors) {
                const props = err?.context?.propertyName;
                const msg = err?.message || errorMessage;
                if (Array.isArray(props)) {
                    for (const prop of props) {
                        if (prop === 'email') fieldErrors.email = msg;
                        else if (prop === 'firstname')
                            fieldErrors.firstName = msg;
                        else if (prop === 'lastname')
                            fieldErrors.lastName = msg;
                        else if (prop === 'phone') fieldErrors.phone = msg;
                        else if (
                            prop.startsWith('im___') ||
                            prop === 'hs_whatsapp_phone_number'
                        )
                            fieldErrors.imHandle = msg;
                    }
                }
            }
        }

        const statusCode = error.status || 500;
        const responseBody = {
            error: errorMessage,
            code: errorCode,
            details: error.details || error.message || 'Unknown error',
        };

        if (Object.keys(fieldErrors).length > 0) {
            responseBody.fieldErrors = fieldErrors;
        }

        if (Object.keys(partialSuccess).length > 0) {
            responseBody.partialSuccess = partialSuccess;
        }

        return res.status(statusCode).json(responseBody);
    }
});

console.log('Starting static production server');

// Serve static files from the build directory
const clientBuildPath = path.join(__dirname, 'build');
app.use(
    express.static(clientBuildPath, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
            // Cache hashed assets aggressively
            if (filePath.includes('/assets/')) {
                res.setHeader(
                    'Cache-Control',
                    'public, max-age=31536000, immutable',
                );
            }
            // Don't cache HTML files
            else if (filePath.endsWith('.html')) {
                res.setHeader(
                    'Cache-Control',
                    'no-cache, no-store, must-revalidate',
                );
            }
            // Cache service worker for 24 hours
            else if (filePath.endsWith('sw.js')) {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        },
    }),
);

// SPA fallback - Express 5 requires explicit wildcard syntax
app.use(async (req, res, next) => {
    if (req.method !== 'GET') {
        return next();
    }

    try {
        const indexPath = path.join(clientBuildPath, 'index.html');
        const html = await readFile(indexPath, 'utf-8');
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
        console.error('SPA fallback error:', error);
        next(error);
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => {
    if (HOST_PORT) {
        console.log(
            `Production server is running on http://localhost:${HOST_PORT}`,
        );
    } else {
        console.log(`Production server is running on http://localhost:${PORT}`);
    }
});
