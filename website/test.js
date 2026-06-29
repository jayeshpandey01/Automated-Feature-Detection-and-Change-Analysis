const http = require('http');
http.get('http://localhost:3000/api/image/69e7ee28c0639910f3b6f888', (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  res.on('data', () => {});
}).on('error', (e) => console.error(e));
