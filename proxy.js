const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const net = require('net'); // Импортируем net

const app = express();
const requestsLog = [];
const caCert = fs.readFileSync('./ca.crt'); // Корневой сертификат
const serverKey = fs.readFileSync('./mail.ru.key'); // Закрытый ключ сервера
const serverCert = fs.readFileSync('./mail.ru.crt'); // Сертификат сервера

app.use(bodyParser.json());

const mixinAllowMethods = {
    'Allow': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*'
};


const callbackServer = (req, res) => {
    // Здесь вы можете использовать тот же код, что и для proxyServer
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

    // Логируем запрос
    requestsLog.push(options);
    console.log(options);

    // Обработка метода OPTIONS
    if (req.method === 'OPTIONS') {
        res.writeHead(200, mixinAllowMethods);
        return res.end();
    }

    // Отправляем запрос на указанный хост
    const proxyRequest = https.request(options, (proxyResponse) => {
        Object.assign(proxyResponse.headers, mixinAllowMethods);
        res.writeHead(proxyResponse.statusCode, proxyResponse.headers);
        proxyResponse.pipe(res, { end: true });
    });

    // Обработка ошибок
    proxyRequest.on('error', (error) => {
        console.error('Proxy error:', error);
        res.writeHead(500);
        res.end('Proxy error');
    });

    // Если есть тело запроса, отправляем его
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(proxyRequest, { end: true });
    } else {
        proxyRequest.end();
    }
};

// Проксирование запросов
const proxyServer = http.createServer(callbackServer);

// Обработка HTTPS CONNECT запросов
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

// Создаем HTTPS сервер
const httpsServer = https.createServer({
    key: serverKey,
    cert: serverCert,
    ca: caCert,
}, callbackServer);

// Эндпоинты API
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
        // Логика повторной отправки запроса
        res.send('Request repeated');
    } else {
        res.status(404).send('Not Found');
    }
});

app.post('/scan/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (id < requestsLog.length) {
        // Логика сканирования запроса
        res.send('Request scanned');
    } else {
        res.status(404).send('Not Found');
    }
});

// Запуск серверов
proxyServer.listen(9090, () => {
    console.log('Proxy server listening on port 9090');
});

app.listen(9000, () => {
    console.log('API server listening on port 9000');
});

// Запускаем сервер на порту 9091
httpsServer.listen(9091, () => {
    console.log('HTTPS Proxy server is running on https://127.0.0.1:9091');
});