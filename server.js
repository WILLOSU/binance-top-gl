const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const http = require('http');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let symbols = [];
const changes = {};

// Rota para servir a página HTML
app.use(express.static(__dirname));

// Função para iniciar a conexão com a Binance e WebSocket
async function start() {
    const { data } = await axios.get("https://api.binance.com/api/v3/exchangeInfo");
    symbols = data.symbols.filter(s => s.quoteAsset === "USDT").map(s => s.symbol.toLowerCase());
    const streams = symbols.map(s => `${s}@kline_1m`).join("/");

    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = (event) => {
        const obj = JSON.parse(event.data);
        if (obj.data.k.x) {
            const openPrice = parseFloat(obj.data.k.o);
            const closePrice = parseFloat(obj.data.k.c);
            const change = ((closePrice * 100) / openPrice) - 100;
            changes[obj.data.s] = change;
        }
    };

    ws.onerror = (error) => console.error(error);

    setInterval(() => {
        const changeArray = Object.keys(changes).map(k => {
            return { symbol: k, change: changes[k] };
        });

        const topGainers = changeArray.sort((a, b) => b.change - a.change).slice(0, 5);
        const topLosers = changeArray.sort((a, b) => a.change - b.change).slice(0, 5);

        const result = {
            topGainers: topGainers,
            topLosers: topLosers,
            resetCountdown: true // Indica para o cliente resetar o contador
        };

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(result));
            }
        });

    }, 60000); // Atualização a cada 60 segundos
}

wss.on('connection', (ws) => {
    console.log('Client connected');
});
/*
server.listen(process.env.PORT || 3000, () => {
    console.log('Server is listening on port 3000');
    start();
});
*/


server.listen(3000, () => {
    console.log('Server is listening on port 3000');
    spawn('cmd', ['/c', 'start', 'http://localhost:3000']);  // Abre o navegador automaticamente
    start();
});
