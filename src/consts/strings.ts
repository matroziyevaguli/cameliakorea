import { useLocale, type Locale } from '@/i18n'

// Canonical vocabulary — see docs/redesign.md §1. `S` is the Uzbek source; `useS()` returns the
// same shape localized (en/ru/ko override, uz falls back to `S`), so `S.foo` call-sites become
// `const S = useS()` with no other change.
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

export type SShape = typeof S
// en/ru/ko full translations (uz lives in S above). Function entries mirror S's signatures.
const T: Record<Exclude<Locale, 'uz'>, SShape> = {
  en: {
    welcome: 'Welcome! ✨', namePlaceholder: 'Your name', passPlaceholder: 'Password', loginBtn: 'Sign in',
    loginWrongPassword: 'Wrong password. Try again.', loginNetworkError: 'Could not sign in — check your connection and retry.',
    forgotPassword: 'Forgot your password? Message Guli', loggingIn: 'Signing in…', logout: 'Log out',
    greeting: (name) => `Hi, ${name}! 👋`, myProducts: 'My products', remaining: (n) => `${n} left`, soldBtn: 'Sold', noProducts: 'No products yet',
    addSale: 'Add a sale', pickProduct: 'Pick a product…', quantity: 'Quantity', fullPrice: 'Full price', discountPrice: 'Discount price',
    otherPrice: 'Other', pricePlaceholder: 'Enter price', note: 'Note (optional)', notePlaceholder: 'e.g. with a discount',
    confirm: 'Confirm', saving: 'Saving…', saleSuccess: 'Great! Sale added 🎉', tooMany: (n) => `Only ${n} available`, total: 'Total',
    mySales: 'My sales', noSales: 'No sales yet', deleteConfirm: 'Delete this sale?', delete: 'Delete',
    moneyCollect: 'To collect', moneyHandedOver: 'Handed over', moneySettled: 'Settled', earningsSeller: 'Your earnings', earningsAdmin: 'My earnings',
    myBalance: 'My account', myEarnings: 'Your earnings', earningsHint: (pct) => `${pct}% profit — yours`, toHandOver: 'To collect', handedOver: 'Handed over',
    stillOwed: 'To collect (remaining)', settled: 'Well done! Balance cleared ✓', paymentHistory: 'Payment history', noPayments: 'No payments yet',
    tapForDetails: 'Tap for details', breakdownTitle: 'How the money is split', collected: 'Collected from customers', yoursKept: (pct) => `Your earnings (${pct}%) — yours`,
    cameliaShare: "Camelia's share", ofWhichPaid: 'Handed over', ofWhichLeft: 'Remaining (not handed over)',
    breakdownNote: (pct) => `You take the full amount from customers. You keep ${pct}%, and hand the rest to Camelia.`,
    openingDebt: 'Opening debt', salesDebt: 'Debt from sales', totalOwed: 'Your debt', paid: 'Paid', remaining_bal: 'Remaining debt', noData: 'No data found',
    help: 'Help', helpTitle: 'Need help?', helpSubtitle: 'No silly questions — we’re here to help.', helpTelegram: 'Message Guli on Telegram',
    helpCall: 'Call Guli', helpVideo: 'Video: how to sell', helpVideoSub: '1-minute guide',
    settings: 'Settings', bigText: 'Large text', bigTextSub: 'Show text bigger', changePassword: 'Change password', myRequests: 'My requests',
    welcomeTitle: 'When you sell, tap this button', welcomeBody: 'Under each product there’s a big green "Sold" button. Tap it — done.',
    welcomeReassure: 'If you make a mistake, nothing is lost. Try it freely! 🌸', welcomeStart: 'Let’s start',
    sellStep1: 'What did you sell?', sellStep2: 'How many and for how much?', sellStep3: 'Confirm?', onlyInStock: 'Only in-stock products are shown',
    noStockToSell: 'No products to sell', continueBtn: 'Continue', reviewLine: (qty, name, amount) => `You sold ${qty} × ${name} for ${amount}.`,
    youEarned: 'You earned:', confirmYes: 'Yes, correct', confirmNo: 'No, back', undoBtn: (s) => `Undo (${s}s)`, undoExpired: 'To fix it, open "My sales"',
    pickFromHome: 'Pick a product from the home page to sell.', sellAgain: 'Sell again', goHome: 'Home', offlineSaved: 'Saved ⏳',
    offlineSavedSub: 'No internet — it will send automatically when back online.', pendingFlushed: (n) => `${n} sale(s) sent ✓`, pendingWaiting: (n) => `⏳ ${n} sale(s) waiting for internet`,
    som: 'so’m', pcs: 'pcs',
  },
  ru: {
    welcome: 'Добро пожаловать! ✨', namePlaceholder: 'Ваше имя', passPlaceholder: 'Пароль', loginBtn: 'Войти',
    loginWrongPassword: 'Неверный пароль. Попробуйте снова.', loginNetworkError: 'Не удалось войти — проверьте интернет и повторите.',
    forgotPassword: 'Забыли пароль? Напишите Гули', loggingIn: 'Вход…', logout: 'Выйти',
    greeting: (name) => `Привет, ${name}! 👋`, myProducts: 'Мои товары', remaining: (n) => `осталось ${n}`, soldBtn: 'Продано', noProducts: 'Пока нет товаров',
    addSale: 'Добавить продажу', pickProduct: 'Выберите товар…', quantity: 'Количество', fullPrice: 'Полная цена', discountPrice: 'Цена со скидкой',
    otherPrice: 'Другая', pricePlaceholder: 'Введите цену', note: 'Заметка (необязательно)', notePlaceholder: 'напр.: со скидкой',
    confirm: 'Подтвердить', saving: 'Сохранение…', saleSuccess: 'Отлично! Продажа добавлена 🎉', tooMany: (n) => `Доступно только ${n}`, total: 'Итого',
    mySales: 'Мои продажи', noSales: 'Продаж пока нет', deleteConfirm: 'Удалить эту продажу?', delete: 'Удалить',
    moneyCollect: 'К сбору', moneyHandedOver: 'Передано', moneySettled: 'Расчёт', earningsSeller: 'Ваш доход', earningsAdmin: 'Мой доход',
    myBalance: 'Мой счёт', myEarnings: 'Ваш доход', earningsHint: (pct) => `${pct}% прибыли — вам`, toHandOver: 'К сбору', handedOver: 'Передано',
    stillOwed: 'К сбору (остаток)', settled: 'Молодец! Расчёт закрыт ✓', paymentHistory: 'История платежей', noPayments: 'Платежей пока нет',
    tapForDetails: 'Нажмите — подробнее', breakdownTitle: 'Как делятся деньги', collected: 'Собрано с клиентов', yoursKept: (pct) => `Ваш доход (${pct}%) — вам`,
    cameliaShare: 'Доля Camelia', ofWhichPaid: 'Передано', ofWhichLeft: 'Остаток (не передано)',
    breakdownNote: (pct) => `Вы берёте всю сумму с клиентов. ${pct}% остаётся вам, остальное передаёте Camelia.`,
    openingDebt: 'Начальный долг', salesDebt: 'Долг с продаж', totalOwed: 'Ваш долг', paid: 'Оплачено', remaining_bal: 'Остаток долга', noData: 'Данные не найдены',
    help: 'Помощь', helpTitle: 'Нужна помощь?', helpSubtitle: 'Глупых вопросов нет — мы поможем.', helpTelegram: 'Написать Гули в Telegram',
    helpCall: 'Позвонить Гули', helpVideo: 'Видео: как продавать', helpVideoSub: 'Инструкция на 1 минуту',
    settings: 'Настройки', bigText: 'Крупный текст', bigTextSub: 'Показывать текст крупнее', changePassword: 'Сменить пароль', myRequests: 'Мои запросы',
    welcomeTitle: 'Когда продали — нажмите эту кнопку', welcomeBody: 'Под каждым товаром есть большая зелёная кнопка «Продано». Нажмите — готово.',
    welcomeReassure: 'Ошиблись — ничего не потеряется. Пробуйте смело! 🌸', welcomeStart: 'Начнём',
    sellStep1: 'Что вы продали?', sellStep2: 'Сколько и за сколько?', sellStep3: 'Подтверждаете?', onlyInStock: 'Показаны только товары в наличии',
    noStockToSell: 'Нет товаров для продажи', continueBtn: 'Продолжить', reviewLine: (qty, name, amount) => `Вы продали ${qty} × ${name} за ${amount}.`,
    youEarned: 'Вы заработали:', confirmYes: 'Да, верно', confirmNo: 'Нет, назад', undoBtn: (s) => `Отменить (${s}с)`, undoExpired: 'Чтобы исправить, откройте «Мои продажи»',
    pickFromHome: 'Выберите товар на главной, чтобы продать.', sellAgain: 'Продать ещё', goHome: 'Главная', offlineSaved: 'Сохранено ⏳',
    offlineSavedSub: 'Нет интернета — отправится автоматически при подключении.', pendingFlushed: (n) => `${n} продаж(и) отправлено ✓`, pendingWaiting: (n) => `⏳ ${n} продаж(и) ждут интернет`,
    som: 'сум', pcs: 'шт',
  },
  ko: {
    welcome: '환영합니다! ✨', namePlaceholder: '이름', passPlaceholder: '비밀번호', loginBtn: '로그인',
    loginWrongPassword: '비밀번호가 틀렸습니다. 다시 시도하세요.', loginNetworkError: '로그인 실패 — 인터넷을 확인 후 다시 시도하세요.',
    forgotPassword: '비밀번호를 잊으셨나요? Guli에게 문의', loggingIn: '로그인 중…', logout: '로그아웃',
    greeting: (name) => `${name}님, 안녕하세요! 👋`, myProducts: '내 상품', remaining: (n) => `${n}개 남음`, soldBtn: '판매', noProducts: '아직 상품이 없어요',
    addSale: '판매 추가', pickProduct: '상품 선택…', quantity: '수량', fullPrice: '정가', discountPrice: '할인가',
    otherPrice: '기타', pricePlaceholder: '가격 입력', note: '메모 (선택)', notePlaceholder: '예: 할인 적용',
    confirm: '확인', saving: '저장 중…', saleSuccess: '좋아요! 판매가 추가됐어요 🎉', tooMany: (n) => `${n}개만 있어요`, total: '합계',
    mySales: '내 판매', noSales: '아직 판매가 없어요', deleteConfirm: '이 판매를 삭제할까요?', delete: '삭제',
    moneyCollect: '수금 예정', moneyHandedOver: '전달됨', moneySettled: '정산', earningsSeller: '내 수익', earningsAdmin: '내 수익',
    myBalance: '내 계정', myEarnings: '내 수익', earningsHint: (pct) => `${pct}% 수익 — 내 몫`, toHandOver: '수금 예정', handedOver: '전달됨',
    stillOwed: '수금 예정 (잔여)', settled: '수고했어요! 정산 완료 ✓', paymentHistory: '결제 내역', noPayments: '아직 결제가 없어요',
    tapForDetails: '탭하여 상세 보기', breakdownTitle: '금액 분배 방식', collected: '고객에게 받은 금액', yoursKept: (pct) => `내 수익 (${pct}%) — 내 몫`,
    cameliaShare: 'Camelia 몫', ofWhichPaid: '전달됨', ofWhichLeft: '잔여 (미전달)',
    breakdownNote: (pct) => `고객에게 전액을 받습니다. ${pct}%는 내 몫이고 나머지는 Camelia에 전달합니다.`,
    openingDebt: '기초 부채', salesDebt: '판매 부채', totalOwed: '내 부채', paid: '지불됨', remaining_bal: '잔여 부채', noData: '데이터가 없습니다',
    help: '도움말', helpTitle: '도움이 필요하세요?', helpSubtitle: '어떤 질문도 괜찮아요 — 도와드릴게요.', helpTelegram: '텔레그램으로 Guli에게 문의',
    helpCall: 'Guli에게 전화', helpVideo: '영상: 판매하는 법', helpVideoSub: '1분 가이드',
    settings: '설정', bigText: '큰 글씨', bigTextSub: '글씨를 더 크게', changePassword: '비밀번호 변경', myRequests: '내 요청',
    welcomeTitle: '판매하면 이 버튼을 누르세요', welcomeBody: '각 상품 아래에 큰 초록색 "판매" 버튼이 있어요. 누르면 끝.',
    welcomeReassure: '실수해도 아무것도 사라지지 않아요. 편하게 해보세요! 🌸', welcomeStart: '시작하기',
    sellStep1: '무엇을 판매했나요?', sellStep2: '몇 개, 얼마에?', sellStep3: '확인할까요?', onlyInStock: '재고가 있는 상품만 표시됩니다',
    noStockToSell: '판매할 상품이 없어요', continueBtn: '계속', reviewLine: (qty, name, amount) => `${name} ${qty}개를 ${amount}에 판매했습니다.`,
    youEarned: '수익:', confirmYes: '네, 맞아요', confirmNo: '아니요, 뒤로', undoBtn: (s) => `취소 (${s}초)`, undoExpired: '수정하려면 "내 판매"를 여세요',
    pickFromHome: '판매하려면 홈에서 상품을 선택하세요.', sellAgain: '다시 판매', goHome: '홈', offlineSaved: '저장됨 ⏳',
    offlineSavedSub: '인터넷 없음 — 연결되면 자동 전송됩니다.', pendingFlushed: (n) => `판매 ${n}건 전송됨 ✓`, pendingWaiting: (n) => `⏳ 판매 ${n}건이 인터넷을 기다립니다`,
    som: '숨', pcs: '개',
  },
}

// Localized seller vocabulary. Use as `const S = useS()`; call-sites keep `S.foo` / `S.foo(arg)`.
export function useS(): SShape {
  const locale = useLocale()
  return locale === 'uz' ? S : T[locale]
}
