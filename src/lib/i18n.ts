import { useRouter } from 'next/router'

export type Locale = 'en' | 'ko' | 'uz'

const copy = {
  en: {
    metaTitle: 'Gulchiroy Matroziyeva — Full-stack Developer', metaDescription: 'Full-stack developer building production web, backend, iOS, desktop, AI, and 3D products.',
    nav: ['Work', 'About', 'Experience'], talk: "Let's talk", available: 'Available for meaningful collaborations', hero1: 'I build end-to-end', hero2: 'products that work.',
    heroBody: 'Full-stack developer moving freely across frontend, backend, iOS, and 3D from database design and APIs to interfaces people can trust.', location: 'Seoul, South Korea', delivery: '04+ years · End-to-end delivery',
    selected: '01 / Selected work', workTitle: 'Products with a pulse.', workIntro: 'A selection of shipped work where engineering meets real human needs.', explore: 'Explore all projects', independent: 'Independent', technologies: 'Technologies used',
    about: '02 / About', aboutTitle: 'One product. Every layer.', lead: "I'm Gulchiroy, a full-stack developer with four years of production experience across React and Next.js, Node and NestJS, SwiftUI, Electron, AI integrations, and interactive 3D.",
    bio: 'I have shipped products in solar energy, insurance, healthcare, education, e-commerce, clean energy, and mobility. On several projects I owned the complete path from database schema and API contract to interface and deployment. I work in Korean, English, and Uzbek, and use AI tools thoughtfully throughout research, implementation, and review.',
    principles: ['Own the whole system', 'Learn unfamiliar domains fast', 'Build for reliable delivery'], experience: '03 / Experience', experienceTitle: 'Four years. One evolving craft.', resume: 'Full résumé',
    contact: '04 / Contact', contactTitle: 'Have a problem worth solving?', contactBody: "Let's make something useful, memorable, and beautifully engineered.", footer: 'Designed with intention. Built with care.',
    archiveTitle: 'Project Archive', backHome: 'Back home', archiveLabel: 'GM / Project archive', collection: 'The full collection', archiveHero: "Things I've helped bring to life.", archiveIntro: 'From carbon-footprint tools to hospital booking systems, these projects reflect a practical approach to technology: make it useful, dependable, and easy to understand.', allProjects: 'All projects',
    caseStudy: 'Case study', timeline: 'Timeline', madeAt: 'Made at', visit: 'Visit project', gallery: 'gallery', comingSoon: 'Visual case study coming soon.', loading: 'Loading project…', home: 'Home'
  },
  ko: {
    metaTitle: '굴리 마트로지예바 — 풀스택 개발자', metaDescription: '웹, 백엔드, iOS, 데스크톱, AI, 3D 프로덕트를 만드는 풀스택 개발자입니다.',
    nav: ['프로젝트', '소개', '경력'], talk: '연락하기', available: '의미 있는 협업을 기다리고 있습니다', hero1: '처음부터 끝까지', hero2: '작동하는 제품을 만듭니다.',
    heroBody: '프론트엔드, 백엔드, iOS, 3D를 자유롭게 넘나들며 데이터베이스와 API부터 신뢰할 수 있는 인터페이스까지 설계합니다.', location: '대한민국 서울', delivery: '경력 4년+ · 엔드투엔드 개발',
    selected: '01 / 주요 프로젝트', workTitle: '실제로 쓰이는 제품.', workIntro: '기술과 실제 사용자의 필요가 만나는 지점에서 출시한 작업들입니다.', explore: '모든 프로젝트 보기', independent: '개인 프로젝트', technologies: '사용 기술',
    about: '02 / 소개', aboutTitle: '하나의 제품. 모든 레이어.', lead: 'React와 Next.js, Node와 NestJS, SwiftUI, Electron, AI 연동, 인터랙티브 3D까지 4년간 프로덕션 경험을 쌓아온 풀스택 개발자 굴리입니다.',
    bio: '태양광, 보험, 헬스케어, 교육, 이커머스, 클린에너지, 모빌리티 분야의 제품을 출시했습니다. 여러 프로젝트에서 데이터베이스 스키마와 API 계약부터 UI와 배포까지 전 과정을 책임졌습니다. 한국어, 영어, 우즈베크어로 일하며 리서치, 구현, 리뷰 전반에 AI 도구를 신중하게 활용합니다.',
    principles: ['시스템 전체를 책임집니다', '낯선 도메인을 빠르게 배웁니다', '안정적인 출시를 위해 만듭니다'], experience: '03 / 경력', experienceTitle: '4년, 계속 확장되는 개발 역량.', resume: '이력서 전체 보기',
    contact: '04 / 연락처', contactTitle: '함께 해결할 문제가 있나요?', contactBody: '유용하고 기억에 남으며 견고하게 설계된 제품을 함께 만들어요.', footer: '의도를 담아 디자인하고, 세심하게 개발했습니다.',
    archiveTitle: '프로젝트 아카이브', backHome: '홈으로', archiveLabel: 'GM / 프로젝트 아카이브', collection: '전체 작업', archiveHero: '세상에 내놓은 프로젝트들.', archiveIntro: '탄소발자국 도구부터 병원 예약 시스템까지, 유용하고 안정적이며 이해하기 쉬운 기술을 만들었습니다.', allProjects: '모든 프로젝트',
    caseStudy: '케이스 스터디', timeline: '기간', madeAt: '소속', visit: '프로젝트 보기', gallery: '갤러리', comingSoon: '비주얼 케이스 스터디를 준비 중입니다.', loading: '프로젝트를 불러오는 중…', home: '홈'
  },
  uz: {
    metaTitle: 'Gulchiroy Matroziyeva — Full-stack dasturchi', metaDescription: 'Web, backend, iOS, desktop, AI va 3D mahsulotlarini yaratuvchi full-stack dasturchi.',
    nav: ['Loyihalar', 'Men haqimda', 'Tajriba'], talk: 'Bog‘lanish', available: 'Mazmunli hamkorlik uchun ochiqman', hero1: 'Boshidan oxirigacha', hero2: 'ishlaydigan mahsulotlar.',
    heroBody: 'Frontend, backend, iOS va 3D bo‘ylab erkin ishlayman — ma’lumotlar bazasi va APIlardan odamlar ishonadigan interfeyslargacha.', location: 'Seul, Janubiy Koreya', delivery: '04+ yil · To‘liq mahsulot yaratish',
    selected: '01 / Tanlangan ishlar', workTitle: 'Jonli mahsulotlar.', workIntro: 'Muhandislik real inson ehtiyojlari bilan uchrashgan ishga tushirilgan loyihalar.', explore: 'Barcha loyihalarni ko‘rish', independent: 'Mustaqil', technologies: 'Ishlatilgan texnologiyalar',
    about: '02 / Men haqimda', aboutTitle: 'Bitta mahsulot. Har bir qatlam.', lead: 'Men Gulchiroy — React va Next.js, Node va NestJS, SwiftUI, Electron, AI integratsiyalari hamda interaktiv 3D bo‘yicha to‘rt yillik tajribaga ega full-stack dasturchiman.',
    bio: 'Quyosh energetikasi, sug‘urta, sog‘liqni saqlash, ta’lim, elektron tijorat, yashil energiya va mobillik sohalarida mahsulotlar chiqarganman. Bir nechta loyihalarda ma’lumotlar bazasi sxemasidan API va interfeysgacha, deploy jarayonigacha to‘liq javobgar bo‘lganman. Koreys, ingliz va o‘zbek tillarida ishlayman, AI vositalaridan tadqiqot, yaratish va kod ko‘rib chiqishda foydalanaman.',
    principles: ['Butun tizim uchun javobgarlik', 'Yangi sohalarni tez o‘rganish', 'Ishonchli yetkazib berish'], experience: '03 / Tajriba', experienceTitle: 'To‘rt yil. Rivojlanayotgan mahorat.', resume: 'To‘liq rezyume',
    contact: '04 / Aloqa', contactTitle: 'Yechishga arziydigan muammo bormi?', contactBody: 'Keling, foydali, esda qolarli va puxta ishlangan mahsulot yarataylik.', footer: 'Maqsad bilan dizayn qilindi. E’tibor bilan yaratildi.',
    archiveTitle: 'Loyihalar arxivi', backHome: 'Bosh sahifaga', archiveLabel: 'GM / Loyihalar arxivi', collection: 'To‘liq to‘plam', archiveHero: 'Hayotga olib kelgan loyihalarim.', archiveIntro: 'Uglerod izi vositalaridan shifoxona bron tizimlarigacha — foydali, ishonchli va tushunarli texnologiyalar.', allProjects: 'Barcha loyihalar',
    caseStudy: 'Keys', timeline: 'Muddat', madeAt: 'Tashkilot', visit: 'Loyihani ko‘rish', gallery: 'galereya', comingSoon: 'Vizual keys tez orada qo‘shiladi.', loading: 'Loyiha yuklanmoqda…', home: 'Bosh sahifa'
  }
} as const

export function useI18n() {
  const router = useRouter()
  const locale = (router.locale || 'en') as Locale
  return { locale, t: copy[locale] || copy.en }
}

export const projectTranslations: Record<'ko' | 'uz', Record<number, { title: string; description: string }>> = {
  ko: {
    15: { title: '모빈스 보험 플랫폼', description: '여행자, 반려동물, 해킹·피싱, 기업 보험을 아우르는 반응형 멀티 상품 신청 플랫폼입니다. Next.js 공통 플로우, REST API, SmartroPAY 결제, 휴대폰 KYC 인증과 Jenkins·GitLab 자동 배포를 구현했습니다.' },
    16: { title: '대성교육개발원 이커머스', description: 'NHN Commerce와 ShopBy 기반 이커머스 플랫폼입니다. Aurora 모듈을 커스터마이징하고 반응형 스토어, ShopBy 워크플로우, Toss Payments 결제와 Git 기반 자동 배포를 구현했습니다.' },
    17: { title: '강남차 초진 상담 서비스', description: '초진 환자를 위한 반응형 상담 설문 서비스입니다. EJS 인터페이스와 상태 흐름부터 Node.js REST API, Oracle·MySQL 연동, 배포와 운영까지 풀스택으로 담당했습니다.' },
    14: { title: '주문 관리 시스템(OMS)', description: '다채널 주문, 재고, 프로모션, 출고와 배송을 관리하는 사내 OMS입니다. 신규 화면 설계부터 운영까지 프론트엔드를 주도하며 jQuery 레거시를 Next.js로 점진적으로 이관하고 공통 컴포넌트, 레이아웃, 필터, 분석 대시보드와 운영 워크플로우를 재구축했습니다.' },
    12: { title: '3D 태양광 분석 플랫폼', description: '업로드한 3D 건물 모델을 인터랙티브 일조량·일사량 히트맵으로 변환하는 웹 플랫폼입니다. 시뮬레이션 리서치부터 Three.js 뷰어, 모델 업로드 파이프라인, 지도 연동까지 전 과정을 담당했습니다.' },
    13: { title: 'AI 수학 퀴즈 플랫폼', description: 'NestJS API, Next.js 관리자 페이지, OpenAI 기반 문제 생성, LaTeX 미리보기, 이미지 업로드, 다양한 문제 유형을 위한 MySQL 모델을 갖춘 교육 플랫폼입니다.' },
    0: { title: 'CO2Network', description: '탄소발자국을 계산하고 기후 프로젝트와 STO 토큰에 투자해 배출량을 상쇄할 수 있는 SwiftUI 앱입니다.' },
    6: { title: 'CO2Network 관리자', description: '사용자, 탄소 계산, 프로젝트 투자와 STO 토큰을 관리하는 관리자용 탄소발자국 플랫폼입니다.' },
    1: { title: 'H2Care Mando', description: '전기차 충전소 검색, 예약, 차량 프로필, 주행·결제 내역과 사전 결제를 제공하는 모빌리티 서비스입니다.' },
    2: { title: 'StoryKorean', description: '맞춤형 퀴즈, Excel 데이터 입력, 안전한 데이터 저장으로 한국어 학습을 돕는 모바일 앱입니다.' },
    3: { title: 'Carfit', description: '렌터카 앱 운영을 위한 관리자 웹사이트입니다.' },
    4: { title: 'DaouSync 웹·데스크톱 앱', description: '웹과 데스크톱 환경에서 실시간 메시징과 데이터 동기화를 제공하는 업무용 애플리케이션입니다.' },
    8: { title: '용인세브란스병원', description: '진료 예약·변경·취소, 일정 확인, 알림과 개인 캘린더 연동을 제공하는 환자용 앱입니다.' },
    9: { title: '분당서울대병원', description: '카카오 스마트채널에서 진료와 입원 예약을 관리하고 알림을 제공하는 병원 웹 서비스입니다.' },
    10: { title: '분당차병원 iOS 앱', description: '진료 예약, 일정 변경·취소, 알림, 캘린더 동기화를 제공하는 환자용 iOS 앱입니다.' },
    11: { title: '잠실차병원 하이브리드 앱', description: 'React와 Swift WebView를 결합해 예약, 알림, 일정 관리를 제공하는 환자용 하이브리드 앱입니다.' }
  },
  uz: {
    15: { title: 'Mobins sug‘urta platformasi', description: 'Sayohat, uy hayvonlari, xakerlik va fishing hamda korporativ sug‘urta uchun responsive platforma. Next.js umumiy oqimlari, REST API, SmartroPAY, mobil KYC va Jenkins/GitLab deployini yaratdim.' },
    16: { title: 'Daesung Education e-commerce', description: 'NHN Commerce va ShopBy asosidagi e-commerce platformasi. Aurora modullarini moslashtirdim, responsive do‘kon, ShopBy jarayonlari, Toss Payments va Git orqali avtomatik deployni yaratdim.' },
    17: { title: 'Gangnam CHA birinchi tashrif konsultatsiyasi', description: 'Birinchi marta keluvchi bemorlar uchun responsive so‘rov xizmati. EJS interfeysidan Node.js REST API, Oracle va MySQL integratsiyasi, deploy va xizmat ko‘rsatishgacha to‘liq yaratdim.' },
    14: { title: 'Buyurtmalarni boshqarish tizimi', description: 'Ko‘p kanalli buyurtma, ombor, promo, jo‘natish va yetkazib berish uchun ichki OMS. Frontendni yangi ekranlardan production qo‘llab-quvvatlashgacha boshqardim, jQuery tizimini Next.js ga bosqichma-bosqich ko‘chirib, umumiy komponentlar, filtrlar, tahlil va ish jarayonlarini qayta qurdim.' },
    12: { title: '3D quyosh tahlil platformasi', description: 'Yuklangan 3D bino modellarini interaktiv quyosh va radiatsiya issiqlik xaritalariga aylantiruvchi web platforma. Tadqiqotdan Three.js ko‘ruvchisi, model yuklash va xarita integratsiyasigacha yaratdim.' },
    13: { title: 'AI matematika test platformasi', description: 'NestJS API, Next.js boshqaruv paneli, OpenAI test yaratish, LaTeX ko‘rish, rasm yuklash va MySQL ma’lumotlar modeli bilan ta’lim platformasi.' },
    0: { title: 'CO2Network', description: 'Uglerod izini hisoblash, iqlim loyihalari va STO tokenlariga sarmoya kiritish orqali chiqindilarni qoplash uchun SwiftUI ilovasi.' },
    6: { title: 'CO2Network boshqaruvi', description: 'Foydalanuvchilar, uglerod hisoblari, loyihalar va STO investitsiyalarini boshqarish platformasi.' },
    1: { title: 'H2Care Mando', description: 'Elektr avtomobil quvvatlash stansiyalarini topish, bron qilish, avtomobil profili va to‘lovlarni boshqarish xizmati.' },
    2: { title: 'StoryKorean', description: 'Moslashtirilgan testlar va xavfsiz ma’lumot saqlash orqali koreys tilini o‘rganishga yordam beruvchi mobil ilova.' },
    3: { title: 'Carfit', description: 'Avtomobil ijarasi ilovasi uchun boshqaruv web sayti.' },
    4: { title: 'DaouSync web va desktop', description: 'Real vaqt xabarlari va ma’lumot sinxronizatsiyasini taqdim etuvchi web va desktop ilova.' },
    8: { title: 'Yongin Severance kasalxonasi', description: 'Qabulni bron qilish, o‘zgartirish, bekor qilish, bildirishnoma va kalendar sinxronizatsiyasini taqdim etuvchi bemor ilovasi.' },
    9: { title: 'Bundang SNU kasalxonasi', description: 'Kakao kanalida qabul va yotqizishni bron qilish hamda bildirishnomalarni boshqaruvchi web xizmat.' },
    10: { title: 'Bundang CHA iOS ilovasi', description: 'Bemorlar uchun qabul, jadval, bildirishnoma va kalendar sinxronizatsiyasini boshqaruvchi iOS ilova.' },
    11: { title: 'Jamsil CHA gibrid ilovasi', description: 'React va Swift WebView orqali bron, bildirishnoma va jadval boshqaruvini taqdim etuvchi gibrid ilova.' }
  }
}

export function localizeProject<T extends { id: number; title: string; description: string }>(project: T, locale: Locale): T {
  if (locale === 'en') return project
  const translated = projectTranslations[locale]?.[project.id]
  return translated ? { ...project, ...translated } : project
}

const experienceTranslations: Record<'ko' | 'uz', Record<number, { title: string; subTitle: string; description: string }>> = {
  ko: {
    7: { title: '제스트', subTitle: '프론트엔드 개발자', description: '3D 태양광 분석 플랫폼의 단독 프론트엔드 오너로서 Ladybug·Rhino·Grasshopper 리서치를 Three.js 뷰어, 모델 업로드 파이프라인, Libre Map 기반 서비스로 구현했습니다.' },
    6: { title: '더와이드코넥트', subTitle: '프론트엔드 개발자', description: '사내 주문·재고 관리 시스템을 담당하며 jQuery 레거시를 Next.js로 점진적으로 이관하고 공통 컴포넌트, UX, API 계약과 배포 안정성을 개선했습니다.' },
    5: { title: '키출판사', subTitle: '백엔드 개발자', description: 'NestJS 백엔드, Next.js 관리자 페이지, MySQL 스키마와 OpenAI 기반 수학 문제 생성기를 설계하고 Docker·AWS 환경에 구성했습니다.' },
    4: { title: '넥스트이노베이션', subTitle: '프론트엔드 개발자', description: '재사용 가능한 멀티 포털 Next.js 구조로 5종 보험 상품을 개발하고 REST API, 결제, KYC 인증, CI/CD를 연동했습니다.' },
    3: { title: '씨오투네트워크', subTitle: 'iOS·웹 프론트엔드 개발자', description: 'SwiftUI 앱 2개를 출시하며 TCA, Apollo GraphQL, Lottie, 알림 확장, 테스트와 앱스토어 배포를 담당하고 React 웹 개발도 병행했습니다.' },
    2: { title: '포씨게이트', subTitle: 'iOS·풀스택 개발자', description: '국내 주요 병원의 환자 앱, 하이브리드 앱, 예약 서비스, 설문 웹, REST API와 병원 시스템 연동을 개발했습니다.' },
    1: { title: '알에스인터렉티브', subTitle: '주니어 웹 개발자', description: 'React, Node.js, Electron, AWS를 활용해 전기차 충전, 교육, 렌터카, 실시간 데스크톱 동기화 제품을 개발했습니다.' }
  },
  uz: {
    7: { title: 'Zest', subTitle: 'Frontend dasturchi', description: '3D quyosh tahlil platformasining yagona frontend egasi sifatida Ladybug, Rhino va Grasshopper tadqiqotini Three.js ko‘ruvchisi, model yuklash va Libre Map xizmatiga aylantirdim.' },
    6: { title: 'The Wide Connect', subTitle: 'Frontend dasturchi', description: 'Buyurtma va ombor tizimini boshqarib, jQuery sahifalarini Next.js ga ko‘chirdim, umumiy komponentlar, UX, API shartnomalari va barqarorlikni yaxshiladim.' },
    5: { title: 'Key Publishing', subTitle: 'Backend dasturchi', description: 'NestJS backend, Next.js admin, MySQL sxemasi va OpenAI asosidagi matematika test generatorini yaratib, Docker va AWS muhitiga joyladim.' },
    4: { title: 'Next Innovation', subTitle: 'Frontend dasturchi', description: 'Qayta ishlatiladigan Next.js multi-portal arxitekturasida beshta sug‘urta mahsulotini, REST API, to‘lov, KYC va CI/CD integratsiyalarini yaratdim.' },
    3: { title: 'CO2 Network', subTitle: 'iOS va web frontend dasturchi', description: 'Ikki SwiftUI ilovasini TCA, Apollo GraphQL, Lottie va bildirishnomalar bilan yaratib, test va App Store chiqarilishini boshqardim.' },
    2: { title: '4CGate', subTitle: 'iOS va full-stack dasturchi', description: 'Koreya kasalxonalari uchun bemor iOS va gibrid ilovalari, bron xizmatlari, REST APIlar va ichki tizim integratsiyalarini yaratdim.' },
    1: { title: 'RS Interactive', subTitle: 'Junior web dasturchi', description: 'React, Node.js, Electron va AWS yordamida elektromobil quvvatlash, ta’lim, ijara va real vaqt desktop sinxronizatsiya mahsulotlarini yaratdim.' }
  }
}

export function localizeExperience<T extends { id: number; title: string; subTitle?: string; description: string }>(role: T, locale: Locale): T {
  if (locale === 'en') return role
  const translated = experienceTranslations[locale]?.[role.id]
  return translated ? { ...role, ...translated } : role
}
