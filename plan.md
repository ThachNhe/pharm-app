# Kế Hoạch MVP Pharm App

Cập nhật: 2026-07-29

Tài liệu này chốt phạm vi phiên bản đầu tiên của Pharm App. Mục tiêu hiện tại là hoàn thành một hệ thống đủ dùng cho một đơn vị nhỏ, vận hành tốt các luồng nhập hàng, bán hàng và quản lý tồn kho.

Các chức năng nâng cao vẫn được ghi nhận ở cuối tài liệu nhưng chưa triển khai trong MVP.

## 1. Mục Tiêu MVP

MVP cần giúp một quầy thuốc thực hiện được các công việc hằng ngày:

- Quản lý tài khoản và phân quyền theo quầy.
- Quản lý danh mục thuốc và giá bán.
- Quản lý nhà cung cấp.
- Nhập hàng theo lô và hạn sử dụng.
- Bán hàng tại quầy.
- Theo dõi tồn kho.
- Xem báo cáo doanh thu và lợi nhuận cơ bản.

MVP ưu tiên tính đúng đắn của dữ liệu tiền và tồn kho. Giao diện chỉ cần rõ ràng, dễ dùng và đủ cho quy trình vận hành thực tế.

## 2. Mô Hình Người Dùng Và Phân Quyền

### 2.1 Nguyên tắc đã chốt

- Một user có thể thuộc nhiều quầy thuốc.
- Trong mỗi quầy, user chỉ có đúng một role.
- Role ở quầy này không ảnh hưởng đến role của user ở quầy khác.
- Role cao tự bao gồm toàn bộ quyền của role thấp hơn.
- System Admin là quyền cấp hệ thống, không nằm trong thứ bậc role của một quầy.

Ví dụ hợp lệ:

| User | Quầy | Role |
| --- | --- | --- |
| An | Quầy A | owner |
| An | Quầy B | manager |
| Bình | Quầy A | staff |

Ví dụ không hợp lệ:

| User | Quầy | Role |
| --- | --- | --- |
| An | Quầy A | owner |
| An | Quầy A | manager |
| An | Quầy A | staff |

Trong ví dụ không hợp lệ, chỉ cần lưu role `owner` vì owner đã có quyền của manager và staff.

### 2.2 Thứ bậc role trong quầy

```text
owner
  └── manager
        └── staff
```

Khi kiểm tra quyền, hệ thống so sánh cấp role thay vì yêu cầu user phải có nhiều role.

```text
owner   = 3
manager = 2
staff   = 1
```

Ví dụ:

- API yêu cầu tối thiểu `staff`: owner, manager và staff đều truy cập được.
- API yêu cầu tối thiểu `manager`: owner và manager truy cập được.
- API yêu cầu `owner`: chỉ owner của đúng quầy truy cập được.

### 2.3 System Admin

System Admin vận hành toàn hệ thống:

- Tạo, sửa, khóa hoặc mở quầy thuốc.
- Tạo owner đầu tiên cho quầy.
- Xem và quản lý user toàn hệ thống.
- Xem dữ liệu toàn hệ thống khi cần hỗ trợ.

System Admin không tham gia bán hàng hằng ngày.

### 2.4 Owner

Owner là chủ quầy:

- Có toàn bộ quyền trong quầy.
- Quản lý thông tin quầy.
- Tạo manager hoặc staff.
- Đổi role và khóa/mở tài khoản trong quầy.
- Quản lý thuốc, nhà cung cấp, nhập hàng và bán hàng.
- Xem doanh thu, lợi nhuận và tồn kho.

### 2.5 Manager

Manager là người quản lý vận hành:

- Có toàn bộ quyền của staff.
- Tạo staff trong đúng quầy.
- Quản lý thuốc và nhà cung cấp.
- Nhập hàng.
- Quản lý bán hàng.
- Xem doanh thu và tồn kho của quầy.

Manager không được tạo owner, tạo manager khác hoặc thay đổi cấu hình cấp hệ thống.

### 2.6 Staff

Staff là nhân viên:

- Tra cứu thuốc, giá bán và tồn kho.
- Tạo đơn bán hàng.
- Xem các đơn do mình tạo.
- Xem thông tin cơ bản của quầy đang làm việc.

Staff không được quản lý tài khoản, nhập hàng, thay đổi giá hoặc xem lợi nhuận.

### 2.7 Ma trận quyền MVP

| Chức năng | System Admin | Owner | Manager | Staff |
| --- | --- | --- | --- | --- |
| Quản lý quầy | Toàn hệ thống | Quầy của mình | Xem | Xem cơ bản |
| Quản lý tài khoản | Toàn hệ thống | Owner/Manager/Staff | Staff | Không |
| Quản lý thuốc và giá | Toàn hệ thống | Có | Có | Chỉ xem |
| Quản lý nhà cung cấp | Toàn hệ thống | Có | Có | Chỉ xem |
| Nhập hàng | Xem | Có | Có | Không |
| Bán hàng | Xem | Có | Có | Có |
| Xem tồn kho | Toàn hệ thống | Có | Có | Có |
| Xem doanh thu | Toàn hệ thống | Có | Có | Đơn của mình |
| Xem lợi nhuận | Toàn hệ thống | Có | Có | Không |

Backend phải kiểm tra quyền trong middleware và service. Không được chỉ ẩn nút ở frontend.

## 3. Phạm Vi Chức Năng MVP

### 3.1 Đăng nhập và bảo mật

Đã có:

- Đăng nhập bằng email và mật khẩu.
- Xác minh OTP gửi qua email.
- Access token được giữ trong memory của frontend.
- Refresh token được giữ trong HttpOnly cookie.
- Refresh endpoint chỉ cấp access token mới.
- Mời user qua email để thiết lập mật khẩu.
- Reset mật khẩu bằng token dùng một lần.

Cần hoàn thiện trong MVP:

- Resend OTP có thời gian đếm ngược.
- Giới hạn số lần nhập OTP sai.
- Đổi mật khẩu khi đang đăng nhập.
- Logout và xóa refresh token hiện tại.
- Protected route theo System Admin và role tại quầy.

### 3.2 Quản lý quầy

- System Admin tạo quầy.
- System Admin gán owner đầu tiên.
- Owner sửa tên, địa chỉ và số điện thoại của quầy.
- User có nhiều quầy có thể chọn quầy đang làm việc.
- Mọi API nghiệp vụ phải nhận hoặc xác định rõ `storeId`.

MVP chưa cần quản lý chuỗi nhà thuốc như một thực thể riêng.

### 3.3 Quản lý tài khoản

- Danh sách user trong quầy.
- Mời manager hoặc staff bằng email.
- Thay đổi một role duy nhất của user trong quầy.
- Khóa hoặc mở tài khoản.
- Không cho phép tạo nhiều bản ghi role cho cùng một cặp `userId + storeId`.

### 3.4 Danh mục thuốc

Thông tin tối thiểu:

- Tên thuốc.
- Hoạt chất.
- Hàm lượng.
- Dạng bào chế.
- Đơn vị cơ bản.
- Số đăng ký.
- Nhà sản xuất.
- Barcode.
- Giá bán.
- Trạng thái đang kinh doanh.
- Có yêu cầu đơn thuốc hay không.

Tồn kho luôn lưu theo đơn vị nhỏ nhất. Mỗi thuốc có thể cấu hình thêm đơn vị nhập/bán với hệ số quy đổi, ví dụ `1 vỉ = 10 viên`; backend chịu trách nhiệm quy đổi và chứng từ lưu snapshot đơn vị đã chọn.

### 3.5 Nhà cung cấp

- Tạo, xem, sửa và khóa nhà cung cấp.
- Lưu tên, số điện thoại, email, địa chỉ và ghi chú.
- Tra cứu lịch sử phiếu nhập theo nhà cung cấp.

MVP chưa quản lý công nợ nhà cung cấp.

### 3.6 Nhập hàng

Flow chính:

1. Owner hoặc Manager tạo phiếu nhập.
2. Chọn nhà cung cấp.
3. Thêm thuốc, đơn vị nhập, số lượng, giá nhập theo đơn vị đã chọn, số lô và hạn sử dụng.
4. Kiểm tra dữ liệu.
5. Hoàn tất phiếu nhập.
6. Hệ thống tăng tồn kho theo đúng thuốc, lô và quầy.
7. Hệ thống ghi lịch sử biến động tồn kho.

Quy tắc:

- Phiếu `draft` chưa làm thay đổi tồn kho.
- Chỉ phiếu `completed` mới tăng tồn kho.
- Phiếu đã hoàn tất không được xóa.
- Hoàn tất phiếu và tăng tồn phải nằm trong cùng database transaction.

MVP chưa cần quy trình duyệt phiếu nhập nhiều cấp.

### 3.7 Bán hàng

Flow chính:

1. Nhân viên tìm thuốc bằng tên hoặc barcode.
2. Chọn thuốc, đơn vị bán và số lượng.
3. Hệ thống kiểm tra tồn có thể bán.
4. Nhập giảm giá nếu role được phép.
5. Chọn tiền mặt hoặc chuyển khoản.
6. Hoàn tất đơn.
7. Hệ thống trừ tồn và lưu hóa đơn.

Quy tắc:

- Ưu tiên trừ lô gần hết hạn trước theo FEFO.
- Không bán thuốc đã hết hạn.
- Không cho tồn kho âm.
- Tạo hóa đơn và trừ tồn phải nằm trong cùng database transaction.
- Đơn đã hoàn tất không được sửa trực tiếp.

MVP chỉ cần xem và in hóa đơn HTML đơn giản. Chưa tích hợp hóa đơn điện tử.

### 3.8 Tồn kho

- Xem tổng tồn theo thuốc trong từng quầy.
- Xem chi tiết tồn theo lô và hạn sử dụng.
- Tìm kiếm theo tên thuốc hoặc barcode.
- Cảnh báo thuốc sắp hết hàng.
- Cảnh báo lô sắp hết hạn.
- Xem lịch sử nhập và bán làm thay đổi tồn.

MVP chưa có kiểm kê, điều chỉnh tồn thủ công hoặc chuyển kho.

### 3.9 Báo cáo cơ bản

- Doanh thu theo ngày và khoảng thời gian.
- Số lượng hóa đơn.
- Giá vốn.
- Lợi nhuận gộp.
- Thuốc bán chạy.
- Giá trị tồn kho hiện tại.

Báo cáo phải lọc theo quầy. Manager và Owner chỉ xem dữ liệu trong phạm vi được phân quyền.

## 4. Các Màn Hình MVP

```text
/login
/admin
  /dashboard
  /stores
  /users
  /medicines
  /suppliers
  /imports
  /sales
  /inventory
  /reports
```

Không dùng một route `/admin?tab=...` cho toàn bộ module. Mỗi module dùng một route riêng để refresh trang vẫn giữ đúng màn hình và có thể protect route độc lập.

## 5. Thứ Tự Triển Khai

### Giai đoạn 1: Nền tảng và phân quyền

1. Chốt ràng buộc một role cho mỗi user trong mỗi quầy.
2. Tạo store selector cho user thuộc nhiều quầy.
3. Tạo middleware kiểm tra role theo `storeId`.
4. Hoàn thiện protected route frontend.
5. Hoàn thiện resend OTP, đổi mật khẩu và logout.

### Giai đoạn 2: Dữ liệu cơ bản

1. Hoàn thiện CRUD thuốc.
2. Hoàn thiện giá thuốc theo quầy.
3. Hoàn thiện CRUD nhà cung cấp.

### Giai đoạn 3: Nhập hàng và tồn kho

1. Tạo phiếu nhập `draft`.
2. Hoàn tất phiếu nhập bằng transaction.
3. Tạo tồn theo lô và hạn sử dụng.
4. Tạo lịch sử biến động tồn.
5. Làm màn hình tồn kho và cảnh báo.

### Giai đoạn 4: Bán hàng

1. Làm màn hình POS.
2. Tìm thuốc bằng tên và barcode.
3. Trừ tồn theo FEFO bằng transaction.
4. Lưu và in hóa đơn.

### Giai đoạn 5: Báo cáo và hoàn thiện

1. Báo cáo doanh thu và lợi nhuận gộp.
2. Báo cáo tồn kho.
3. Rà soát phân quyền.
4. Viết integration test cho nhập hàng và bán hàng.
5. Kiểm thử toàn bộ flow trên Docker.

## 6. Tiêu Chí Hoàn Thành MVP

MVP được xem là hoàn thành khi:

- Một user có thể làm việc ở nhiều quầy và chỉ có một role tại mỗi quầy.
- User không truy cập được dữ liệu của quầy mà mình không thuộc về.
- Owner tạo được Manager và Staff trong quầy.
- Manager chỉ tạo được Staff trong quầy.
- Staff không truy cập được chức năng quản trị.
- Owner hoặc Manager nhập hàng và tồn tăng đúng theo lô.
- Nhân viên bán hàng và tồn giảm đúng theo FEFO.
- Không thể bán quá tồn hoặc bán lô hết hạn.
- Hóa đơn có thể xem và in.
- Báo cáo doanh thu, lợi nhuận và tồn kho đúng theo quầy.
- Form hiển thị lỗi rõ ràng và chỉ reset sau khi thao tác thành công.
- Các API quan trọng có integration test.

## 7. Chưa Làm Trong MVP

Các chức năng sau chỉ triển khai sau khi MVP vận hành ổn định:

- Khách hàng, bác sĩ và quản lý đơn thuốc chi tiết.
- Trả hàng và hoàn tiền.
- Kiểm kê và điều chỉnh tồn.
- Chuyển kho giữa các quầy.
- Quản lý ca làm.
- Sổ quỹ thu chi.
- Công nợ khách hàng và nhà cung cấp.
- Quy trình phê duyệt nhiều cấp.
- Import và export Excel.
- In tem và mã vạch.
- Hóa đơn điện tử.
- Liên thông Dược Quốc Gia.
- Thông báo realtime.
- Dashboard phân tích nâng cao.

## 8. Nguyên Tắc Kỹ Thuật

- Backend là nguồn quyết định quyền truy cập cuối cùng.
- Mọi truy vấn nghiệp vụ phải giới hạn theo `storeId`.
- Dữ liệu tiền và số lượng dùng kiểu `Decimal`.
- Các thao tác thay đổi tiền và tồn kho phải dùng database transaction.
- Không xóa dữ liệu nghiệp vụ đã làm thay đổi tiền hoặc tồn kho; dùng trạng thái hủy và bút toán bù khi cần.
- API danh sách phải có phân trang, tìm kiếm và sắp xếp.
- Frontend phải hiển thị trạng thái loading, lỗi và thành công rõ ràng.
- Form chỉ reset sau khi server trả về thành công.
- Mỗi flow quan trọng cần có integration test cho trường hợp thành công, sai quyền và dữ liệu không hợp lệ.

## 9. Quyết Định Database Cần Áp Dụng

Quan hệ role trong quầy cần bảo đảm:

```prisma
model UserStoreRole {
  id      String    @id
  userId  String
  storeId String
  role    StoreRole

  @@unique([userId, storeId])
}
```

Ràng buộc `@@unique([userId, storeId])` bảo đảm một user không thể có nhiều role trong cùng một quầy. Khi đổi role, hệ thống cập nhật bản ghi hiện tại thay vì tạo thêm bản ghi mới.
