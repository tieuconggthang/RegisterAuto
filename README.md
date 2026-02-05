# ResAuto1 - Register only (client)

Dự án này **chỉ làm Register** bằng cách đọc `users.csv` và gọi API của backend **authService**.

## 1) Yêu cầu
- NodeJS >= 18
- Backend `authService` đang chạy (mặc định: `http://localhost:3001`)
- Khi test tự động OTP: backend authService phải bật `DEBUG_OTP=true` trong `.env` và restart.

## 2) Cấu hình
Sửa file `.env`:
- `BASE_URL` trỏ tới authService
- `CSV_PATH` file CSV
- `OTP_TIMEOUT_MS`, `OTP_POLL_MS` để poll OTP
- `RUN_ONCE=true` để chạy 1 lần rồi thoát (mặc định đã bật)

### Chạy liên tục để quét CSV
- Đặt `RUN_ONCE=false`
- Chỉnh `INTERVAL_MS` (ví dụ 15000 = 15s)
- Worker sẽ chạy theo interval **và** tự chạy lại khi file CSV thay đổi (fs.watch)

Backend authService phải có các endpoint debug (DEV only):
- `GET /auth/debug/pending-otp?phone=...` (nếu có freeze OTP) **hoặc**
- `GET /auth/debug/redis-otp?phone=...`

## 3) Chạy
```bash
npm install
npm start
```

## 3.1) Log chi tiết
Log ghi vào: `data/logs/worker-YYYY-MM-DD.log` (JSON lines). Các event bạn hay grep:
- `JOB_START`, `CSV_PARSE_OK`, `ROW_START`
- `REGISTER_REQUEST`, `REGISTER_RESPONSE`, `REGISTER_FAIL`, `REGISTER_ALREADY_EXISTS_SKIP`
- `OTP_POLL_START`, `OTP_POLL_TICK`, `OTP_POLL_GOT_OTP`, `OTP_POLL_TIMEOUT`
- `VERIFY_REQUEST`, `VERIFY_RESPONSE`, `VERIFY_FAIL`, `VERIFY_OK`

Để log đầy đủ (mỗi lần poll OTP / mỗi attempt verify):
```env
LOG_LEVEL=debug
LOG_VERBOSE=true
LOG_HTTP=true
```

Mặc định OTP/password sẽ bị che trong log. Nếu muốn hiện rõ (DEV only):
```env
LOG_OTP_PLAINTEXT=true
LOG_PASSWORD_PLAINTEXT=true
```

Worker sẽ:
1. Đọc CSV
2. Gọi `POST /auth/register`
3. Poll OTP bằng debug API
4. Gọi `POST /auth/verify-register-otp`

## 4) Format CSV
File `users.csv` cần header:
- `phone,password,firstName,lastName,gender,dateOfBirth`

Ví dụ:
```csv
phone,password,firstName,lastName,gender,dateOfBirth
0987000002,Abc@1234,Auto,User,MALE,2000-01-01
```
