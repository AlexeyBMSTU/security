mkdir -p ./certs

# Генерация нового закрытого ключа для CA и сохранение в папку certs
openssl genrsa -out ./certs/ca.key 2048

# Создание самоподписанного сертификата для CA и сохранение в папку certs
openssl req -new -x509 -days 3650 -key ./certs/ca.key -out ./certs/ca.crt -subj "/CN=yngwie proxy CA"

# Генерация нового закрытого ключа для прокси-сервера и сохранение в папку certs
openssl genrsa -out ./certs/cert.key 2048

# Создание CSR для прокси-сервера и сохранение в папку certs
openssl req -new -key ./certs/cert.key -subj "/CN=mail.ru" -out ./certs/cert.csr

# Подписание CSR с помощью корневого сертификата (CA) и сохранение в папку certs
openssl x509 -req -in ./certs/cert.csr -CA ./certs/ca.crt -CAkey ./certs/ca.key -CAcreateserial -out ./certs/cert.crt -days 3650