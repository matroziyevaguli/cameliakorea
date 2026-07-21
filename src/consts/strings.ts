// Canonical vocabulary — see docs/redesign.md §1. One concept → one Uzbek word,
// used identically in both apps and the storefront. Never introduce a synonym for
// a concept that already has a term here.
export const S = {
  // Auth
  welcome:        "Xush kelibsiz! ✨",
  namePlaceholder:"Ismingiz",
  passPlaceholder:"Parol",
  loginBtn:       "Kirish",
  loginWrongPassword: "Parol noto'g'ri. Qayta urinib ko'ring.",
  loginNetworkError:  "Kirib bo'lmadi — internetni tekshirib, qayta urining.",
  forgotPassword: "Parolni unutdingizmi? Guliga yozing",
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

  // ── Pipeline B — Money (redesign.md §1.2). These four words are the whole
  // money vocabulary; both apps use them, so a seller and the admin discussing
  // a number are always using the same term.
  moneyCollect:   "Yig'ilishi kerak",       // owed to Camelia (cost + Camelia's share)
  moneyHandedOver:"Topshirildi",            // cash already handed over
  moneySettled:   "Hisob-kitob",            // balance cleared
  earningsSeller: "Daromadingiz",           // the seller's own kept share
  earningsAdmin:  "Mening daromadim",       // the owner's kept share

  // Balance / earnings
  myBalance:      "Mening hisobim",
  myEarnings:     "Sizning daromadingiz",   // seller's own profit share — hers to keep
  earningsHint:   (pct: number) => `${pct}% foyda — sizniki`,
  toHandOver:     "Yig'ilishi kerak",       // = moneyCollect
  handedOver:     "Topshirildi",            // = moneyHandedOver
  stillOwed:      "Yig'ilishi kerak (qolgan)",
  settled:        "Barakalla! Hisob-kitob tozalandi ✓",
  paymentHistory: "To'lov tarixi",
  noPayments:     "Hali to'lov qilinmagan",
  tapForDetails:  "Bosing — batafsil",
  breakdownTitle: "Pul qanday taqsimlanadi",
  collected:      "Mijozlardan yig'ilgan",
  yoursKept:      (pct: number) => `Daromadingiz (${pct}%) — sizniki`,
  cameliaShare:   "Camelia'ga tegishli",
  ofWhichPaid:    "Topshirildi",
  ofWhichLeft:    "Qolgan (topshirilmagan)",
  breakdownNote:  (pct: number) => `Siz mijozlardan to'liq pul olasiz. ${pct}% daromad sizda qoladi, qolganini Camelia'ga topshirasiz.`,
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

  // Sell flow (3 steps)
  sellStep1:       "Nimani sotdingiz?",
  sellStep2:       "Nechta va necha pulga?",
  sellStep3:       "Tasdiqlaysizmi?",
  onlyInStock:     "Faqat omborda bor mahsulotlar ko'rsatiladi",
  noStockToSell:   "Sotish uchun mahsulot yo'q",
  continueBtn:     "Davom etish",
  reviewLine:      (qty: number, name: string, amount: string) => `Siz ${qty} ta ${name}ni ${amount} ga sotdingiz.`,
  youEarned:       "Siz ishladingiz:",
  confirmYes:      "Ha, to'g'ri",
  confirmNo:       "Yo'q, orqaga",
  undoBtn:         (s: number) => `Bekor qilish (${s}s)`,
  undoExpired:     "Tuzatish uchun «Sotuvlarim» ga kiring",
  pickFromHome:    "Sotish uchun bosh sahifadagi mahsulotni tanlang.",
  sellAgain:       "Yana sotish",
  goHome:          "Bosh sahifa",
  offlineSaved:    "Saqlandi ⏳",
  offlineSavedSub: "Internet yo'q — internet kelganda avtomatik yuboriladi.",
  pendingFlushed:  (n: number) => `${n} ta sotuv yuborildi ✓`,
  pendingWaiting:  (n: number) => `⏳ ${n} ta sotuv internetni kutmoqda`,

  // Units
  som:            "so'm",
  pcs:            "ta",
}
