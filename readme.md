Команды:

curl -x http://127.0.0.1:9090 http://mail.ru

curl http://127.0.0.1:9000/requests

curl http://127.0.0.1:9000/requests/0

curl -X POST http://127.0.0.1:9000/scan/0

curl -X POST http://127.0.0.1:9000/repeat/0

# Генерация нового закрытого ключа для CA
openssl genrsa -out ca.key 2048

# Создание самоподписанного сертификата для CA
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=yngwie proxy CA"

# Генерация нового закрытого ключа для прокси-сервера
openssl genrsa -out cert.key 2048

# Создание CSR для прокси-сервера
openssl req -new -key cert.key -subj "/CN=mail.ru" -out cert.csr

# Подписание CSR с помощью корневого сертификата (CA)
openssl x509 -req -in cert.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out cert.crt -days 3650

