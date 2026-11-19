# Sổ tay DIY — tái lập kiến trúc LoRaWAN Chipless RFID (tiếng Việt)

**Phiên bản:** v1.0 · **Đích nghiên cứu:** Gehron, Bakri, El Hadidy & Hahn, IEEE IoTaIS 2024, pp. 113–117, DOI [10.1109/IoTaIS64014.2024.10799492](https://doi.org/10.1109/IoTaIS64014.2024.10799492)

> Đây là hướng dẫn tái lập **nguyên lý và chuỗi xử lý**. Bài báo không cung cấp đủ mọi dữ liệu thiết kế SRR, flowgraph GNU Radio, threshold, file IQ hay bản đo gốc để cam kết tái tạo một-một phần cứng và đường cong tác giả. **Mô phỏng là dữ liệu tổng hợp**, không phải RF measurement. Bảo đảm tuân thủ quy định quản lý tần số trước mọi phát xạ.

## 0 — Đọc đúng bài báo trước khi DIY

| Thông số | Căn cứ trong bài |
|---|---|
| FHS quét / nhảy qua dải 1.2–5.4 GHz | Tóm tắt, trang 113 |
| Bốn tần số cộng hưởng 1.4 / 1.8 / 2.4 / 5.2 GHz | Mục II, trang 114 |
| Một notch = bit 1; không notch = bit 0; 16 mã | Mục II, trang 114 |
| Tag 4×4: RCS hơn ô đơn khoảng 20 dB | Mục II, hình 2, trang 114 |
| Bistatic 2 log-periodic UWB 400 MHz–6.2 GHz | Mục II, trang 114 |
| Đo công suất 3 vùng trước/tại/sau notch | Mục II, trang 114 |
| SDR bladeRF 2.0 micro xA4, GNU Radio | Mục II, trang 114 |
| LoRa CSS phát 868 MHz, SF7, BW125 kHz | Mục II–III, trang 115–116 |
| Cầu hai ESP32 LoRa: LoRa PHY → ESP-NOW → LoRaWAN | Mục II, trang 115 |
| TTN OTAA, CayenneLPP; `1111` ↔ `15` | Mục III, trang 116 |
| Thử đường LoRa → gateway đến 5 km | Mục III, trang 116 |

**Khoảng cách không được đánh đồng:** `chipless tag --(phản xạ, thường ngắn)--> SDR reader` khác với `LoRaWAN end device --(LPWAN, km)--> gateway`. Paper kết luận đọc tag ở khoảng cách ngắn và **truyền ID** xa.

## 1 — Reproduce không cần phần cứng (nên làm đầu tiên)

### Cài đặt

Yêu cầu Python 3.10+; chỉ dùng thư viện chuẩn, không cần pip.

**Windows PowerShell:**

```powershell
git clone https://github.com/xulytiengviet/LoRaWAN-Chipless.git
cd LoRaWAN-Chipless
py -3 simulation/chipless.py --bits 1111 --seed 2024 --noise-db 0.8 --out results
py -3 -m unittest discover -s simulation -p "test_*.py" -v
start index.html
```

**Linux / macOS:**

```bash
git clone https://github.com/xulytiengviet/LoRaWAN-Chipless.git
cd LoRaWAN-Chipless
python3 simulation/chipless.py --bits 1111 --seed 2024 --noise-db 0.8 --out results
python3 -m unittest discover -s simulation -p 'test_*.py' -v
python3 -m http.server 8000
# mở http://localhost:8000
```

Sẽ xuất `results/spectrum.csv` (f[GHz], RCS tương đối dB), `results/rcs.svg` (đồ thị), `results/summary.json` (config, 4 notch scores, ID giải mã, benchmark 16×20).

Thử thêm: `--bits 0000`, `--bits 1001`, `--noise-db 4.0`, `--threshold-db 7`, `--array-gain-db 0`. Mỗi bộ config lưu seed để tái lập.

### Mô hình toán — phân biệt dữ kiện và giả định

Bốn tần số gốc `f_i = [1.4, 1.8, 2.4, 5.2]` GHz; mỗi bit `b_i ∈ {0,1}`. Để tạo dữ liệu thử, ta chủ động chọn mô hình:

```text
RCS_sim(f) = baseline(f)
           - Σ_i b_i · A_i · exp(-(f-f_i)²/(2σ_i²))
           + G_array - 20 + ε(f)
```

Trong đó độ sâu `A_i`, độ rộng `σ_i`, baseline, nhiễu Gauss `ε` đều **do repo đặt ra**, không được bài báo cung cấp. `G_array = 20 dB` là tham số tượng trưng mức chênh RCS xấp xỉ 20 dB **bài báo mô tả**, không phải kết quả từ solver điện từ. RCS trên biểu đồ là **giá trị tương đối**; không ghi là dBm đo được.

### Phát hiện FHS / blind notch

Tại mỗi ứng viên `f_i`, đo công suất tại ba vùng:

- Vai trái `[f_i−0.120, f_i−0.075]` GHz.
- Vùng trung tâm `[f_i−0.023, f_i+0.023]` GHz.
- Vai phải `[f_i+0.075, f_i+0.120]` GHz.

Tính `score_i = (mean(left_i)+mean(right_i))/2 - mean(center_i)`; nếu `score_i >= threshold_db` thì bit=1, ngược lại 0. Cửa sổ + ngưỡng mặc định 4.5 dB **là tham số mô phỏng độc lập**, cần tối ưu sau khi thu RCS thực. Cách này thực hiện đúng **ý tưởng so sánh ba vùng** ở bài báo, không được quảng bá là tái tạo chính xác mã FHS gốc.

### Điều kiện PASS bước 1

- `1111 → 15`, `0000 → 0`, `1001 → 9`.
- Bộ unit test bao phủ cả 16 ID và kiểm tra cố định seed.
- `summary.json` phải có `provenance: SYNTHETIC SIMULATION`.
- Khi tăng nhiễu / đổi ngưỡng phải đánh giá xác suất lỗi; không chỉ chạy thẻ `1111`.

## 2 — Mô phỏng điện từ và thiết kế tag SRR 4×4

**Không thể lấy kích thước để gia công đúng tag gốc chỉ từ bài báo 5 trang.** Tác giả nói có các vòng SRR đồng tâm, mảng 4×4 và tham chiếu bài [6] (Improved RCS Chipless RFID Tag Array...). Muốn tái lập *hình học gốc* phải xin CAD/Gerber, độ dày đồng, vật liệu, hằng số điện môi, kích thước từng khe và kích thước mảng từ nhóm tác giả.

Quy trình DIY phiên bản *thiết kế lại độc lập*:

1. Chọn công cụ điện từ: **openEMS** (mã mở), hoặc CST/HFSS nếu có license. Khai báo vật liệu, độ dày nền, copper, dielectric loss và môi trường mô phỏng.
2. Tạo ô cơ sở có bốn thành phần SRR điều chỉnh độc lập tối đa có thể. Tham số hóa bán kính, chiều rộng vạch dẫn, khoảng khe, khoảng cách giữa vòng. Các vòng có tương tác, không giả sử tần số `f ~ 1/R` là đủ chính xác.
3. Chạy quét 1.2–5.4 GHz, tìm bốn cực tiểu phản xạ/RCS ở tần số mục tiêu. Ghi mô hình cổng, phân cực, góc tới và điều kiện biên.
4. Nhân ô thành mảng 4×4 rồi chạy **mô phỏng EM toàn sóng lại**. Chênh RCS do kích thước, hỗ tương, hướng nhìn và phân cực; không đơn giản nhân RCS bằng 16.
5. Thiết kế mẫu có/không có notch tương ứng mỗi bit và chạy lại tối thiểu 16 biến thể. Loại bỏ/mở vòng có thể dịch chuyển cộng hưởng của vòng còn lại.
6. Xuất **CAD/Gerber, stack-up, RCS/S11/S21, phiên bản solver và hình học đặt anten**. Chỉ chuyển sang PCB sau khi cộng hưởng mô phỏng phù hợp.

**Tiêu chí thẩm định:** xác nhận 4 đỉnh suy giảm tại khoảng mong muốn và có khoảng biên giữa score bit 1 và bit 0 lớn hơn sai số nền; độ tăng RCS 20 dB là mục tiêu so sánh với ô đơn trong đúng điều kiện mô phỏng, không bảo đảm xuất hiện trên mọi mẫu.

## 3 — Danh sách phần cứng (BOM thực nghiệm)

| Linh kiện | Số lượng | Chức năng / lưu ý |
|---|---:|---|
| PC Linux/Windows, USB 3.0 | 1 | GNU Radio, Python, logging |
| Nuand bladeRF 2.0 micro xA4 | 1 | 2 TX + 2 RX full duplex; nhà sản xuất công bố 47 MHz–6 GHz |
| Anten log-periodic UWB ~0.4–6.2 GHz | 2 | Bistatic: một phát, một thu; kiểm tra đặc tuyến thực |
| Cáp coax 50 Ω + SMA | 2+ | Đúng đầu nối, kiểm tra suy hao |
| RF attenuator + tải 50 Ω + che chắn | Theo bench | Test vô tuyến **có kiểm soát**, bảo vệ RX |
| Thẻ PCB SRR 4×4 | ≥1 mẫu | Gia công sau khi hoàn tất bước 2 |
| ESP32 LoRa có radio phù hợp | 2 | ESP32 A và B; xác nhận khả năng ESP-NOW và LoRaWAN stack |
| Gateway LoRaWAN đúng region | 1 | Gateway chứ không chỉ LoRa P2P receiver |
| Tài khoản The Things Stack | 1 | Application, end device OTAA, uplink logs |

**Giá thành:** không cố định trong báo cáo này. BladeRF đắt hơn nhiều board SX127x; radio rẻ chỉ thu một vài băng hẹp không thể thay thế đầu thu SDR quét 5.2 GHz. BladeRF xA4 theo nhà sản xuất bao phủ băng yêu cầu; cần phần mềm/driver tương thích.

## 4 — Lắp đầu đọc SDR và hiệu chỉnh

```text
GNU Radio / Python FHS -> bladeRF TX port -> TX UWB antenna
                                         | phát tín hiệu khảo sát
                                    [PCB SRR tag 4x4]
                                         | tán xạ
GNU Radio / Python FHS <- bladeRF RX port <- RX UWB antenna
```

### Chuẩn bị an toàn trước phát RF

- **Ưu tiên đường RF khép kín, có suy hao và tải chuẩn** để kiểm tra SDR, rồi phòng che chắn / phòng thử nghiệm được phép khi khảo sát thẻ không dây.
- **Không chạy sweep phát xạ ngoài trời 1.2–5.4 GHz**; dải này đi qua nhiều hệ thống đang khai thác. Cần phép, kiểm tra EIRP, thiết bị, anten và địa điểm.
- Bảo vệ đầu vào RX khỏi rò TX quá lớn; dùng suy hao, cách ly anten và kiểm tra công suất bằng thiết bị chuẩn.

### Các bước kỹ thuật

1. Cài driver bladeRF chính thức; xác nhận thiết bị bằng công cụ `bladeRF-cli` và phiên bản firmware/FPGA; lưu kết quả.
2. Cài GNU Radio và backend bladeRF tương ứng (ví dụ Osmocom Source/Sink khi được phiên bản hỗ trợ). Chạy sơ đồ thu mẫu từ đường RF đã suy hao; xác nhận sample rate/gain không tràn.
3. Đo `noise floor` trên từng dải; kiểm tra DC offset, IQ imbalance, ảnh gương, rò đường TX→RX.
4. Tạo phép quét **nhiều lần đổi tần số trung tâm** (sweep/hop) do tức thời băng thông SDR không bao trùm 1.2–5.4 GHz. Mỗi điểm cần đo sau khi PLL/gain ổn định và xử lý cửa sổ.
5. Đo trường hợp `background` (không có thẻ), `reference target` (nếu có) và `tag present` ở cùng hình học. Ghi cả IQ nguyên thủy để phân tích lại.
6. Trừ/chuẩn hóa nền và so sánh phổ; kiểm tra phép đo có thật tại cả 4 vùng notch. Không trộn số liệu chụp ở gain/sweep/time khác nếu chưa hiệu chuẩn.
7. Xuất CSV `frequency_ghz,power_db` hoặc `frequency_ghz,rcs_db`, sau đó chạy adapter (bước 5).

**Hình 2 trong bài là đồ thị RCS mô phỏng EM 4×4**. **Hình 5 là bàn đo lớp học không hiệu chuẩn phòng**. Không nên đọc độ sâu notch từ ảnh chụp hình 2 để coi là bản đo máy chuẩn tuyệt đối.

## 5 — Đưa CSV đo thực qua cùng detector

Adapter repo hỗ trợ phổ từ GNU Radio, VNA hoặc pipeline tự phát triển (sau xử lý nền). Tối thiểu 3 vùng quanh **tất cả bốn** tần số cộng hưởng phải có các điểm đo.

```bash
python examples/detect_csv.py results/spectrum.csv --threshold-db 4.5
# CSV đo thực (cột frequency_ghz,power_db) sau khi đã hiệu chuẩn:
python examples/detect_csv.py measurements/tagA_calibrated.csv --threshold-db 4.5 --measured
```

**Dữ liệu đo khác dữ liệu tổng hợp:** `--measured` chỉ là nhãn người vận hành khai báo, KHÔNG tự xác minh phần cứng/hiệu chuẩn. Ghi kèm metadata: calibration, SDR serial, gain, anten, tag geometry, distance, angle, timestamp UTC, region, raw IQ hash.

## 6 — LoRa PHY → ESP-NOW → LoRaWAN (không đánh đồng ba giao thức)

Kiến trúc gốc theo hình 1 và trang 115:

```text
FHS detects 4 bits
    → GNU Radio LoRa CSS PHY (paper: 868 MHz, SF7 BW125)
    → ESP32 A: LoRa PHY packet RX
    → ESP-NOW unicast + CRC/sequence
    → ESP32 B: LoRaWAN end device (OTAA)
    → gateway
    → The Things Stack Live Data
```

**Triển khai theo từng đoạn kiểm chứng:**

1. Trên SDR, thử `gr-lora_sdr` với dữ liệu mẫu trong kết nối suy hao và xem waterfall, xác minh frame thu được trên radio LoRa tương thích. Hệ sinh thái GNU Radio có khác biệt ABI/API theo phiên bản; phải kiểm tra gr-lora_sdr và bladeRF trên cùng bản GNU Radio.
2. Đóng gói `{version:1, id:0..15, sequence, crc}` cho radio P2P thay vì gửi chuỗi tùy ý, để test dễ và tránh lỗi mất/trùng frame.
3. ESP32 A RX → xác thực checksum, ID 0–15 → ESP-NOW unicast đến MAC của ESP32 B. ESP-NOW là đường nội bộ, không phải LoRaWAN và **không có tầm phủ vài km như LoRa**.
4. ESP32 B nhận ESP-NOW, đưa ID vào hàng đợi → radio LoRaWAN gửi một byte lên The Things Stack. Dùng **LoRaWAN stack có OTAA đầy đủ**, không chỉ `LoRa.begin()` rồi gọi là LoRaWAN.
5. Chạy end-to-end với **ID 0x0F (15)**, xác minh payload uplink nguyên vẹn. Khóa OTAA nằm ở firmware / provisioning an toàn, **không lưu GitHub, không hiển thị trình duyệt**.

**Vùng tần số:** bài báo thực nghiệm ở **EU868**. TTN liệt kê **Việt Nam AS923-925 (“AS2”)**, và trong The Things Stack frequency plan `AS_923_925` là băng ≥923 MHz. Đừng nhầm plan này với `AS_923_2` (Group 2, tần số mặc định 921.x MHz) — đó là hai định danh khác nhau. Cấu hình phần cứng/gateway theo kế hoạch hợp lệ tại địa điểm; bản kê TTN không thay thế văn bản pháp luật. Ngoài ra SDR→ESP32 A và ESP32 B→gateway phải cấu hình radio tương thích với thiết bị địa phương, không thể cứ sao chép 868 MHz.

## 7 — The Things Stack: uplink thật

1. Tạo **Application** trong console The Things Stack.
2. Đăng ký **End Device** đúng model, LoRaWAN stack version, **frequency plan đúng gateway**, kích hoạt OTAA.
3. Thiết lập `DevEUI`, `JoinEUI` và `AppKey` theo hướng dẫn thiết bị/stack; giữ AppKey bí mật; theo dõi join-request/join-accept.
4. Phía ESP32 B: `uint8_t payload[1] = { (uint8_t)(id & 0x0F) };` và gửi bằng API LoRaWAN của stack, không bằng LoRa P2P.
5. Vào **Payload formatters → Uplink**, chọn JavaScript, dán [`examples/ttn-payload-formatter.js`](../examples/ttn-payload-formatter.js). Ở `Live Data`, ví dụ 0x0F cần hiển thị `id_binary=1111`, `id_decimal=15`.
6. Ghi reception metadata `RSSI/SNR/gateway ID/time` từ message thực. Đối chiếu đúng ID với thẻ đang đặt cạnh anten.

Lưu ý paper dùng **CayenneLPP**. Decoder repo đưa ra **phương án tối giản độc lập (1 byte)** để DIY dễ kiểm chứng, không được coi là cùng wire-format với CayenneLPP của nhóm tác giả. Nếu cần tái lập đúng hình 7, phải triển khai encoder/decoder CayenneLPP tương ứng với firmware và channel gốc.

## 8 — Quy trình thí nghiệm để có chứng cứ công bố

### Ma trận đo đề nghị (không phải số liệu bài báo)

- Tối thiểu **16 ID × 30 lần lặp** ở một hình học chuẩn, sau đó mở rộng cự ly và góc quay.
- Mỗi lần đo ghi `tag_id_truth, tag_id_decoded, distance_cm, angle_deg, gain_db, trial, seed_or_iq_file, background_ref, timestamp`.
- Đánh giá `exact-ID accuracy`, `bit-error-rate (BER)`, `false positive rate` khi **không có thẻ**, khoảng tin cậy 95% (nếu có thử nghiệm đủ mẫu).
- Phép đo gần/xa phải tách khỏi thử nghiệm LoRaWAN về gateway. Khi đo km, ghi địa hình, độ cao anten, LOS/NLOS, spreading factor, BW, gateway, PDR, RSSI, SNR.
- So sánh **cell đơn và array 4×4** trong cùng điều kiện; báo cáo chênh lệch RCS đã hiệu chuẩn và sai số. Không gán sẵn +20 dB làm kết quả quan sát.
- Public repo: CSV sau chuẩn hóa, raw IQ nếu dung lượng/giấy phép cho phép, metadata, CAD, firmware, GNU Radio flowgraphs, commit hash, môi trường và script kiểm định.

### Mức độ tuyên bố trong báo cáo

| Nhãn | Điều kiện |
|---|---|
| **Đã tái lập mô phỏng nguyên lý** | Có code, seed, test, CSV, hình + dữ liệu tổng hợp |
| **Đã xác nhận thẻ bằng mô phỏng EM** | Có solver, CAD, cấu trúc thẻ và RCS điện từ toàn sóng |
| **Đã đo RFID chipless bằng SDR** | Có mẫu vật lý, calibration, IQ/CSV thật |
| **Đã xác nhận LoRaWAN** | Có log OTAA, uplink gateway và TTN thật |
| **Đã tái lập khoảng cách 5 km** | Có đo tuyến thực tới gateway, điều kiện và dữ liệu gói |

**Tuyệt đối không suy luận “100% đạt paper” từ đồ thị Gaussian hoặc mock TTN.**

## 9 — Xử lý sự cố

| Hiện tượng | Kiểm tra |
|---|---|
| Không thấy notch 5.2 GHz | Anten/cáp/SDR/đường quét phải hỗ trợ tần số này; thiết kế SRR và góc tới |
| Notch 2.4 GHz nhiễu | WLAN 2.4 GHz; thử môi trường che chắn/được phép, chuẩn hóa nền |
| Mã lúc đúng lúc sai | Trung bình nhiều sweep; thêm hysteresis/quality score; cố định gain và hình học |
| Spectrogram LoRa có chirp mà ESP32 không nhận | Kiểm tra SF, BW, center frequency, sync word, preamble, IQ inversion và CRC |
| ESP-NOW chạy, TTN không có uplink | LoRa P2P khác LoRaWAN; kiểm tra Join OTAA, gateway, region, keys |
| Có uplink nhưng ID sai | Kiểm tra frame byte order, CayenneLPP hoặc decoder 1-byte, sequence và CRC |

## 10 — Tài liệu nền

- IEEE paper: https://doi.org/10.1109/IoTaIS64014.2024.10799492
- SRR array, tham khảo [6] trong paper: https://doi.org/10.1109/RADIOELEKTRONIKA57919.2023.10109004
- GNU Radio LoRa PHY: https://github.com/tapparelj/gr-lora_sdr
- Nuand bladeRF: https://www.nuand.com/product/bladeRF-xA4/
- The Things Stack OTAA: https://www.thethingsindustries.com/docs/hardware/devices/adding-devices/manual/otaa/
- TTN country plans: https://www.thethingsnetwork.org/docs/lorawan/frequencies-by-country/
- The Things Stack frequency-plan IDs: https://www.thethingsindustries.com/docs/concepts/features/lorawan/frequency-plans/

Mọi bảng chú thích thuộc tài liệu DIY này là độc lập, dựa trên diễn giải có dẫn nguồn; không sao chép hình/bản PDF có bản quyền vào repository.
