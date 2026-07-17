export const S = {
  // Auth
  welcome:        "Xush kelibsiz! ✨",
  namePlaceholder:"Ismingiz",
  passPlaceholder:"Parol",
  loginBtn:       "Kirish",
  loginError:     "Ism yoki parol noto'g'ri",
  loggingIn:      "Kirilmoqda…",
  logout:         "Chiqish",

  // Seller home
  greeting:       (name: string) => `Salom, ${name}! 👋`,
  myProducts:     "Mening mahsulotlarim",
  remaining:      (n: number) => `${n} ta qoldi`,
  soldBtn:        "Sotildi",
  noProducts:     "Hozircha mahsulot yo'q",

  // Sale form
  addSale:        "Sotuvni qo'shish",
  pickProduct:    "Mahsulotni tanlang…",
  quantity:       "Soni",
  fullPrice:      "To'liq narx",
  discountPrice:  "Chegirma narx",
  otherPrice:     "Boshqa",
  pricePlaceholder:"Narxni kiriting",
  note:           "Izoh (ixtiyoriy)",
  notePlaceholder:"Masalan: chegirma bilan",
  confirm:        "Tasdiqlash",
  saving:         "Saqlanmoqda…",
  saleSuccess:    "Zo'r! Sotuv qo'shildi 🎉",
  tooMany:        (n: number) => `Faqat ${n} ta bor`,
  total:          "Jami",

  // My sales
  mySales:        "Mening sotuvlarim",
  noSales:        "Hali sotuv yo'q",
  deleteConfirm:  "Bu sotuvni o'chirasizmi?",
  delete:         "O'chirish",

  // Balance / earnings
  myBalance:      "Mening hisobim",
  myEarnings:     "Sizning daromadingiz",   // seller's own profit share — hers to keep
  earningsHint:   (pct: number) => `${pct}% foyda — sizniki`,
  toHandOver:     "Topshirish kerak",       // total she must give admin
  handedOver:     "Topshirilgan",           // already paid
  stillOwed:      "Qolgan (topshirish)",    // still owed
  settled:        "Barakalla! Hisob-kitob tozalandi ✓",
  paymentHistory: "To'lov tarixi",
  noPayments:     "Hali to'lov qilinmagan",
  tapForDetails:  "Bosing — batafsil",
  breakdownTitle: "Pul qanday taqsimlanadi",
  collected:      "Mijozlardan yig'ilgan",
  yoursKept:      (pct: number) => `Sizning foydangiz (${pct}%) — sizniki`,
  cameliaShare:   "Camelia'ga tegishli",
  ofWhichPaid:    "Topshirildi",
  ofWhichLeft:    "Qolgan (topshirilmagan)",
  breakdownNote:  (pct: number) => `Siz mijozlardan to'liq pul olasiz. ${pct}% foyda sizda qoladi, qolganini Camelia'ga topshirasiz.`,
  openingDebt:    "Boshlang'ich qarz",
  salesDebt:      "Sotuvlardan qarz",
  totalOwed:      "Sizning qarzingiz",
  paid:           "To'langan",
  remaining_bal:  "Qolgan qarz",
  noData:         "Ma'lumot topilmadi",

  // Help (Yordam)
  help:            "Yordam",
  helpTitle:       "Yordam kerakmi?",
  helpSubtitle:    "Hech qanday savol yo'q — biz yordam beramiz.",
  helpTelegram:    "Guliga Telegram'da yozish",
  helpCall:        "Guliga qo'ng'iroq qilish",
  helpVideo:       "Video: qanday sotish kerak",
  helpVideoSub:    "1 daqiqalik ko'rsatma",

  // Settings (Sozlamalar)
  settings:        "Sozlamalar",
  bigText:         "Katta shrift",
  bigTextSub:      "Matnlarni kattaroq ko'rsatish",
  changePassword:  "Parolni o'zgartirish",
  myRequests:      "Mening so'rovlarim",

  // First-run welcome
  welcomeTitle:    "Sotganda, shu tugmani bosing",
  welcomeBody:     "Har bir mahsulot ostida katta yashil \"Sotildi\" tugmasi bor. Bosing — tamom.",
  welcomeReassure: "Xato qilsangiz — hech narsa yo'qolmaydi. Bemalol sinab ko'ring! 🌸",
  welcomeStart:    "Boshladik",

  // Units
  som:            "so'm",
  pcs:            "ta",
}
