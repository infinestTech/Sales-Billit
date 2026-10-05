'use strict';
/**
 * Resolves which products (service / sales) a shop is subscribed to.
 * Source of truth is CommonDB; falls back to the plan mirrored on the Mongo role.
 */

const axiosIPv4 = require('./axiosConfig');
const { Shop, Role } = require('../models/mongoModels');

const PRODUCT_ACCESS_TTL_MS = 60 * 1000;
const productAccessCache = new Map(); // shopId -> { value, expires }

function accessFromMongoPlanId(mongoPlanId, mongoCategoryId) {
    const id = mongoPlanId || '';
    if (mongoCategoryId === 'Sales_Service' || id.startsWith('combo-')) return { service: true, sales: true };
    if (mongoCategoryId === 'Sales' || id.startsWith('sales-')) return { service: false, sales: true };
    if (mongoCategoryId === 'Service' || id.startsWith('service-')) return { service: true, sales: false };
    return null;
}

async function resolveShopProductAccess(shopId) {
    const key = String(shopId);
    const cached = productAccessCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;

    const shop = await Shop.findById(shopId).select('mysql_user_id role_id').lean();
    if (!shop) return null;

    let value = null;
    try {
        const { data } = await axiosIPv4.get(
            `${process.env.AUTH_SERVER_URL}/internal-user-product-access/${encodeURIComponent(shop.mysql_user_id)}`,
            { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } }
        );
        if (data && (data.service || data.sales)) {
            value = {
                service: !!data.service,
                sales: !!data.sales,
                salesMongoPlanId: data.salesMongoPlanId || null,
                plans: Array.isArray(data.plans) ? data.plans : [],
                source: 'subscription'
            };
        }
    } catch (err) {
        console.warn('⚠️ Product access lookup via CommonDB failed:', err.response?.data || err.message);
    }

    // Fallback: plan mirrored on the Mongo role
    if (!value && shop.role_id) {
        const role = await Role.findById(shop.role_id).select('mongoPlanId mongoCategoryId').lean();
        const access = role && accessFromMongoPlanId(role.mongoPlanId, role.mongoCategoryId);
        if (access) {
            value = {
                ...access,
                salesMongoPlanId: access.sales ? role.mongoPlanId : null,
                plans: [{ mongoPlanId: role.mongoPlanId, mongoCategoryId: role.mongoCategoryId, grants: access }],
                source: 'role'
            };
        }
    }

    // Legacy shops without any resolvable plan keep the original service-only portal
    if (!value) {
        value = { service: true, sales: false, salesMongoPlanId: null, plans: [], source: 'default' };
    }

    value.mysqlUserId = shop.mysql_user_id;
    productAccessCache.set(key, { value, expires: Date.now() + PRODUCT_ACCESS_TTL_MS });
    return value;
}

module.exports = { accessFromMongoPlanId, resolveShopProductAccess };
