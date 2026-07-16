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
  myEarnings:     "Sizning daromadingiz",   // seller's own 40% — hers to keep
  earningsHint:   "40% foyda — sizniki",
  toHandOver:     "Topshirish kerak",       // total she must give admin
  handedOver:     "Topshirilgan",           // already paid
  stillOwed:      "Qolgan (topshirish)",    // still owed
  settled:        "Barakalla! Hisob-kitob tozalandi ✓",
  paymentHistory: "To'lov tarixi",
  noPayments:     "Hali to'lov qilinmagan",
  tapForDetails:  "Bosing — batafsil",
  breakdownTitle: "Pul qanday taqsimlanadi",
  collected:      "Mijozlardan yig'ilgan",
  yoursKept:      "Sizning foydangiz (40%) — sizniki",
  cameliaShare:   "Camelia'ga tegishli",
  ofWhichPaid:    "Topshirildi",
  ofWhichLeft:    "Qolgan (topshirilmagan)",
  breakdownNote:  "Siz mijozlardan to'liq pul olasiz. 40% foyda sizda qoladi, qolganini Camelia'ga topshirasiz.",
  openingDebt:    "Boshlang'ich qarz",
  salesDebt:      "Sotuvlardan qarz",
  totalOwed:      "Sizning qarzingiz",
  paid:           "To'langan",
  remaining_bal:  "Qolgan qarz",
  noData:         "Ma'lumot topilmadi",

  // Units
  som:            "so'm",
  pcs:            "ta",
}
