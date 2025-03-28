const { PORT_API_SERVER, PORT_PROXY_HTTPS_SERVER, PORT_PROXY_SERVER } = require('./consts');
const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const net = require('net');

const app = express();
const requestsLog = [];
const caCert = fs.readFileSync('./certs/ca.crt'); 
const serverKey = fs.readFileSync('./certs/cert.key'); 
const serverCert = fs.readFileSync('./certs/cert.crt'); 


app.use(bodyParser.json());

const mixinAllowMethods = {
    'Allow': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*'
};


const callbackServer = (req, res) => {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
        res.writeHead(400);
        return res.end('Bad Request: Missing Host Header');
    }

    const [host, port = 443] = hostHeader.split(':');
    const relativePath = req.url;

 delete req.headers['proxy-connection'];

    const options = {
        hostname: host,
        port: port,
        path: relativePath,
        method: req.method,
        headers: req.headers
    };

    requestsLog.push(options);
    console.log(options);

    if (req.method === 'OPTIONS') {
        res.writeHead(200, mixinAllowMethods);
        return res.end();
    }

    const proxyRequest = https.request(options, (proxyResponse) => {
        Object.assign(proxyResponse.headers, mixinAllowMethods);
        res.writeHead(proxyResponse.statusCode, proxyResponse.headers);
        proxyResponse.pipe(res, { end: true });
    });

    proxyRequest.on('error', (error) => {
        console.error('Proxy error:', error);
        res.writeHead(500);
        res.end('Proxy error');
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(proxyRequest, { end: true });
    } else {
        proxyRequest.end();
    }
};

const proxyServer = http.createServer(callbackServer);

proxyServer.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = new URL(`https://${req.url}`);

    const serverSocket = net.connect(port, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
        console.error(`Error: ${err}`);
        clientSocket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        clientSocket.end();
    });
});

const httpsServer = https.createServer({
    key: serverKey,
    cert: serverCert,
    ca: caCert,
}, callbackServer);

app.get('/requests', (req, res) => {
    res.json(requestsLog);
});

app.get('/requests/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (id < requestsLog.length) {
        res.json(requestsLog[id]);
    } else {
        res.status(404).send('Not Found');
    }
});

app.post('/repeat/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (id < requestsLog.length) {
        const requestToRepeat = requestsLog[id];
        res.send('Request repeated');
    } else {
        res.status(404).send('Not Found');
    }
});

app.post('/scan/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (id < requestsLog.length) {
        res.send('Request scanned');
    } else {
        res.status(404).send('Not Found');
    }
});

proxyServer.listen(PORT_PROXY_SERVER, () => {
    console.log(`Proxy server listening on port ${PORT_PROXY_SERVER}`);
});

app.listen(PORT_API_SERVER, () => {
    console.log(`API server listening on port ${PORT_API_SERVER}`);
});

httpsServer.listen(PORT_PROXY_HTTPS_SERVER, () => {
    console.log(`HTTPS Proxy server is running on port ${PORT_PROXY_HTTPS_SERVER}`);
});