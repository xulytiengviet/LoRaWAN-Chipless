# Vietnam-first v1.1 — cập nhật 2026

> **[Mở Vietnam Field Lab: thử nghiệm giảm nhiễu, mô hình chi phí/năng lượng, Ring-108 và preflight AS923-2](vn-lab.html)** · [Giao thức kiểm chứng chi tiết](docs/VIETNAM-RESEARCH.md) · [Thiết kế phần cứng DIY](docs/HARDWARE-VN.md)
>
> **LƯU Ý QUY ĐỊNH:** Việt Nam: LPWAN miễn giấy phép theo điều kiện **920–923 MHz, ≤25 mW ERP, duty cycle đầu cuối ≤1%, gateway ≤10%** (VBHN 01/VBHN-BKHCN, 2025, Phụ lục 19). Lập kế hoạch LoRaWAN **AS923 Group 2**; không dùng `AS_923_925` mặc định chỉ vì một trang TTN cũ liệt kê AS2. Trình mô phỏng **không phát RF**. Tần số khảo sát RFID riêng biệt và cần thẩm định pháp lý. [Nguồn chính thức](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/6/01-vbhn-bkhcn.pdf).
>
> Các tuyên bố giảm giá/kích thước/điện và tăng độ chính xác **chưa được xác nhận trên phần cứng**. Phương án một notch trong Vietnam Lab chỉ mang 1 bit, không thay thế thẻ IEEE bốn bit về dung lượng mã.

# LoRaWAN-Chipless — DIY reproduction lab (IEEE IoTaIS 2024)

> **Bản tái lập mô phỏng độc lập** của kiến trúc bài báo *IoT LoRaWAN Chipless RFID Reader based on SDR and Blind Detection Technique* (Gehron, Bakri, El Hadidy, Hahn), IEEE IoTaIS 2024, DOI [10.1109/IoTaIS64014.2024.10799492](https://doi.org/10.1109/IoTaIS64014.2024.10799492). Không phải mã nguồn, CAD hoặc số đo gốc của nhóm tác giả.

## Mục tiêu

1. Mô phỏng phổ phản xạ chipless RFID 4 notch **1.4, 1.8, 2.4, 5.2 GHz** và mảng **4 × 4**.
2. Tái hiện nguyên lý **Frequency Hopping–Sweeping (FHS)** / phát hiện notch bằng 3 miền: vai trái, tâm, vai phải.
3. Giải mã **4 bit** (16 định danh); ví dụ theo bài báo: `1111 → 15`.
4. Minh họa chirp **LoRa CSS**, chuỗi relay và payload cloud **giả lập**.
5. Hướng dẫn triển khai thực nghiệm từ phần mềm → SDR đo có hiệu chuẩn → LoRaWAN/TTN, **không phát sóng băng rộng không phép**.

## Chạy ngay

- **Trình duyệt:** mở [`index.html`](index.html), hoặc bật GitHub Pages từ `main/(root)` tại **Settings → Pages**.
- **Python 3.10+ (chỉ dùng thư viện chuẩn):**

```bash
python simulation/chipless.py --bits 1111 --seed 2024 --noise-db 0.8 --out results
python -m unittest discover -s simulation -p "test_*.py" -v
```

Sản phẩm `results/`: `spectrum.csv`, `summary.json`, `rcs.svg`. `results/` là dữ liệu **tạo sinh**, không phải phép đo từ bài báo.

## Phạm vi kiểm chứng — không tráo kết quả mô phỏng thành đo đạc

| Nội dung | Báo cáo gốc | Trong repo |
|---|---|---|
| 4 notch (1.4 / 1.8 / 2.4 / 5.2 GHz) | Có | Mô phỏng tham số |
| Thẻ 4 bit / 16 tổ hợp | Có | Kiểm thử toàn bộ 16 mã |
| Mảng 4×4; tăng RCS khoảng 20 dB | Báo cáo mô phỏng tăng xấp xỉ 20 dB | Tham số gain +20 dB, **không phải mô phỏng EM toàn sóng** |
| Đọc mã `1111` | Đã đo | Kiểm thử tái lập trên dữ liệu tổng hợp |
| LoRa 868 MHz SF7 BW125 | Mô hình thực nghiệm châu Âu | Minh họa CSS/payload, **không sinh PHY LoRaWAN hợp chuẩn** |
| LoRa đến gateway tối đa 5 km | Thử nghiệm thực địa trong báo cáo | **Chưa xác nhận**, cần đo thật |
| Tag SRR đúng nguyên bản | Có hình / mô tả | **Không có file CAD, kích thước và vật liệu đầy đủ trong bài** |

Một khoảng cách đọc thẻ chipless RFID ngắn **không** biến thành khoảng cách đọc 5 km nhờ LoRaWAN. 5 km là **đoạn truyền dữ liệu từ relay tới gateway**.

## Hướng dẫn DIY

Đọc [**`docs/DIY-VI.md`**](docs/DIY-VI.md) cho danh sách thiết bị, từng bước, cấu hình, an toàn RF, kế hoạch thử nghiệm, phân loại kết quả, tiêu chí pass/fail và cách kết nối The Things Stack.

## Cấu trúc

```text
index.html                   # Dashboard GitHub Pages, hoàn toàn offline
assets/style.css             # Giao diện
assets/app.js                # Mô hình phổ + detector + chart + cloud mock
simulation/chipless.py       # Mô phỏng độc lập bằng Python, xuất CSV/JSON/SVG
simulation/test_chipless.py  # Unit test 16 mã + tính tái lập
docs/DIY-VI.md               # Sổ tay DIY tiếng Việt
.github/workflows/ci.yml     # Chạy kiểm thử tự động
LICENSE                      # MIT (chỉ mã do dự án viết)
```

## Tham khảo và giới hạn

- Bài báo gốc: https://doi.org/10.1109/IoTaIS64014.2024.10799492
- PHY GNU Radio tham khảo: https://github.com/tapparelj/gr-lora_sdr
- SDR: https://www.nuand.com/product/bladeRF-xA4/
- The Things Network frequency plan: https://www.thethingsnetwork.org/docs/lorawan/frequencies-by-country/
- The Things Stack OTAA: https://www.thethingsindustries.com/docs/hardware/devices/adding-devices/manual/otaa/

**Lưu ý địa phương (sửa 2026):** Bài báo dùng EU868. Theo 01/VBHN-BKHCN/2025, LPWAN miễn giấy phép theo điều kiện ở Việt Nam dùng **920–923 MHz**; cấu hình AS923 Group 2 với đúng plan gateway, EIRP/ERP, phát xạ và duty cycle. Tham khảo [nghiên cứu pháp lý kỹ thuật](docs/VIETNAM-RESEARCH.md).
