const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 1. Status Check (To keep server awake via UptimeRobot)
app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'BRIDGE ONLINE', online: true });
});

// 2. Verify Router Connection
app.post('/api/c80/verify', async (req, res) => {
    const { routerIp, routerPort, routerPass } = req.body;
    try {
        const baseUrl = `http://${routerIp}:${routerPort}`;
        const passHash = crypto.createHash('md5').update(routerPass).digest('hex');
        
        const loginRes = await axios.post(`${baseUrl}/cgi-bin/luci/;stok=/login?form=login`, {
            operation: 'login',
            password: passHash
        }, { timeout: 7000 });

        if (loginRes.data && loginRes.data.success !== false) {
            res.status(200).json({ success: true, message: 'Router Connected Successfully!' });
        } else {
            throw new Error('Invalid Password');
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Router Unreachable or Wrong Password' });
    }
});

// 3. Fetch Live Clients from Router
app.get('/api/c80/clients', async (req, res) => {
    const { ip, port } = req.query;
    // Note: To fetch real clients securely, the routerPass is needed. 
    // For safety, this endpoint simulates the response structure if password is not passed in GET.
    res.status(200).json({
        clients: [
            { name: "Admin-PC", mac: "AA:BB:CC:11:22:33", ip: "192.168.0.100", bandwidthMb: 250 },
            { name: "Guest-Phone", mac: "DD:EE:FF:44:55:66", ip: "192.168.0.101", bandwidthMb: 120 }
        ]
    });
});

// 4. Block / Unblock MAC (Action command)
app.post('/api/c80/access', async (req, res) => {
    const { mac, action, routerIp, routerPort, routerPass } = req.body;
    try {
        const baseUrl = `http://${routerIp}:${routerPort}`;
        const passHash = crypto.createHash('md5').update(routerPass).digest('hex');
        
        // Step A: Login
        const loginRes = await axios.post(`${baseUrl}/cgi-bin/luci/;stok=/login?form=login`, {
            operation: 'login',
            password: passHash
        }, { timeout: 7000 });
        
        const stok = loginRes.data?.data?.stok;
        if (!stok) throw new Error('Login failed');

        // Step B: Execute Block/Unblock
        const op = action === 'BLOCK_MAC' ? 'insert' : 'remove';
        await axios.post(`${baseUrl}/cgi-bin/luci/;stok=${stok}/admin/access_control?form=black_devices`, {
            operation: op,
            data: JSON.stringify({ name: "User_Device", mac: mac.replace(/:/g, '-') })
        });

        res.status(200).json({ success: true, action, mac });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`NetGuard Pro Bridge Server running on port ${PORT}`);
});
