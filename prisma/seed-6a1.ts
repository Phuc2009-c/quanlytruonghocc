import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Dữ liệu học sinh giả lập chuẩn hóa (Benchmark Synthetic Data - Anonymized for Data Privacy)
const studentsData = Array.from({ length: 48 }, (_, idx) => {
  const num = String(idx + 1).padStart(2, "0");
  const isFemale = idx % 2 === 1;
  return {
    studentCode: `HS6A1_${num}`,
    name: `Học sinh Mẫu 6A1-${num}`,
    dob: `2014-0${(idx % 9) + 1}-15`,
    gender: isFemale ? "FEMALE" : "MALE",
    phone: `090000${String(idx + 1).padStart(4, "0")}`,
    fatherName: `Phụ huynh Cha ${num}`,
    fatherJob: "Nhân viên",
    fatherBirthYear: 1980 + (idx % 10),
    motherName: `Phụ huynh Mẹ ${num}`,
    motherJob: "Kinh doanh",
  };
});


async function main() {
  console.log("Xóa toàn bộ học sinh cũ...");
  
  // Delete all users with role STUDENT (cascades student deletion)
  const deletedUsers = await prisma.user.deleteMany({
    where: { role: "STUDENT" },
  });
  console.log(`Đã xóa ${deletedUsers.count} tài khoản học sinh cũ.`);

  console.log("Đang khởi tạo Lớp 6A1 và 48 học sinh mới...");

  let school = await prisma.school.findFirst();
  if (!school) {
    school = await prisma.school.create({
      data: { name: "Trường THCS Chu Văn An", address: "Hà Nam" },
    });
  }

  let class6A1 = await prisma.classRoom.findFirst({ where: { name: "6A1" } });
  if (!class6A1) {
    class6A1 = await prisma.classRoom.create({
      data: {
        name: "6A1",
        gradeLevel: 6,
        schoolId: school.id,
      },
    });
  }

  const defaultPasswordHash = await bcrypt.hash("123456", 10);
  let createdCount = 0;

  for (const s of studentsData) {
    const email = `hs.${s.studentCode.toLowerCase()}@school.edu.vn`;

    await prisma.user.create({
      data: {
        name: s.name,
        email,
        password: defaultPasswordHash,
        role: "STUDENT",
        student: {
          create: {
            studentCode: s.studentCode,
            classId: class6A1.id,
            dob: new Date(s.dob),
            gender: s.gender as any,
            phone: s.phone,
            ethnicity: "Kinh",
            fatherName: s.fatherName,
            fatherJob: s.fatherJob,
            fatherBirthYear: s.fatherBirthYear,
            motherName: s.motherName,
            motherJob: s.motherJob,
          },
        },
      },
    });
    createdCount++;
  }

  console.log(`Hoàn tất: Đã khởi tạo sạch dữ liệu và thêm mới thành công ${createdCount} học sinh Lớp 6A1!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
