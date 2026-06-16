const express = require('express');
const router = express.Router();
const prisma = require('../prisma/prismaClient');
const authenticateToken = require('../middleware/authenticateToken');


router.get('/profile/subscription/get', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId; // ✅ from decoded JWT


        const subscriptions = await prisma.subscription.findMany({
            where: { userId },
            select: {
                id: true,
                product: true,
                status: true,
                startDate: true,
                endDate: true,
            },
            orderBy: { startDate: 'desc' },
        });


        res.json(subscriptions);
    } catch (err) {
        console.error('❌ Failed to fetch subscriptions:', err);
        res.status(500).json({ message: 'Failed to fetch subscriptions' });
    }
});


module.exports = router;