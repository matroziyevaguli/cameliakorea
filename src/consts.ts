
export interface ProjectsProps {
    id: number;
    image: { type: 'pc' | 'mobile', uri: string }[];
    title: string;
    description: string;
    stacks: string[];
    start_at: string;
    end_at: string;
    made_at?: string;
    link?: string
}

export const PROJECTS_LIST: ProjectsProps[] = [
    {
        id: 15,
        image: [
            { type: 'pc', uri: '/img/mobins/insurance-type.jpeg' },
            { type: 'pc', uri: '/img/mobins/travel-form.jpeg' },
            { type: 'pc', uri: '/img/mobins/country-selector.jpeg' },
            { type: 'pc', uri: '/img/mobins/travel-calendar.jpeg' },
            { type: 'pc', uri: '/img/mobins/plan-comparison.jpeg' },
            { type: 'pc', uri: '/img/mobins/pass-verification.jpeg' },
            { type: 'pc', uri: '/img/mobins/policy-history.jpeg' },
            { type: 'pc', uri: '/img/mobins/customer-support.jpeg' },
        ],
        title: 'Mobins Insurance Platform',
        description: 'A responsive multi-product insurance application covering travel, pets, hacking and phishing, and corporate policies. I built reusable Next.js flows, integrated REST APIs, SmartroPAY payments and mobile KYC, and contributed to automated Jenkins and GitLab delivery.',
        stacks: ["Next.js", "React.js", "TypeScript", "Tailwind CSS", "Redux", "React Query", "Axios", "REST API", "Postman", "SmartroPAY", "KYC", "Jenkins", "GitLab CI/CD"],
        start_at: '2024.08',
        end_at: '2025.02',
        made_at: 'Next Innovation',
        link: 'https://ins.mobins.co.kr/'
    },
    {
        id: 16,
        image: [],
        title: 'Daesung Education E-commerce',
        description: 'An e-commerce platform built on NHN Commerce and ShopBy. I customized Aurora modules, created responsive storefront interactions, integrated ShopBy workflows and Toss Payments, and managed automated deployment through the ShopBy Git platform.',
        stacks: ["HTML", "CSS", "Vanilla JavaScript", "NHN Commerce", "ShopBy API", "ShopBy Custom Modules", "Aurora Modules", "Toss Payments"],
        start_at: '2024.12',
        end_at: '2025.01',
        made_at: 'Next Innovation',
        link: 'https://dsdo.co.kr/'
    },
    {
        id: 17,
        image: [],
        title: 'Gangnam CHA First-Visit Consultation',
        description: 'A responsive consultation questionnaire for first-time hospital patients. I owned the full stack—from the EJS interface and state flows to Node.js REST APIs, Oracle and MySQL integration, deployment, and ongoing operation.',
        stacks: ["EJS", "HTML", "CSS", "JavaScript", "Node.js", "REST API", "Oracle", "MySQL"],
        start_at: '2023.09',
        end_at: '2023.10',
        made_at: '4CGate',
        link: 'https://gangnamm.chamc.co.kr/survey/gynec?TPATNO=Z12340000'
    },
    {
        id: 14,
        image: [
            { type: 'pc', uri: '/img/oms/dashboard-overview.jpeg' },
            { type: 'pc', uri: '/img/oms/dashboard-analytics.jpeg' },
            { type: 'pc', uri: '/img/oms/delivery-tracking.jpeg' },
            { type: 'pc', uri: '/img/oms/order-management.jpeg' },
        ],
        title: 'Order Management System',
        description: 'An internal OMS for multi-channel order, inventory, promotion, fulfillment, and delivery operations. I led the frontend from new screen design through production support, progressively migrating the legacy jQuery experience to Next.js and rebuilding shared components, layouts, filters, analytics, and operational workflows.',
        stacks: ["Next.js", "TypeScript", "REST API", "jQuery Migration", "Data Visualization", "Responsive UI"],
        start_at: '2025.06',
        end_at: '2026.01',
        made_at: 'The Wide Connect'
    },
    {
        id: 12,
        image: [],
        title: '3D Solar Analysis Platform',
        description: 'A web platform that turns uploaded 3D building models into interactive sunlight and solar-radiation heatmaps. I owned the product from simulation research through the Three.js viewer, model-upload pipeline, and map context.',
        stacks: ["Next.js", "React.js", "TypeScript", "Tailwind CSS", "Axios", "React Query", "Three.js", "Libre Maps", "Python", "FastAPI", "Ladybug", "ladybug-core", "ladybug-radiance", "Honeybee Radiance", "Radiance", "Rhino", "Grasshopper"],
        start_at: '2026.01',
        end_at: '2026.04',
        made_at: 'Zest',
        link: 'https://www.codebook.io/login'
    },
    {
        id: 13,
        image: [],
        title: 'AI Math Quiz Platform',
        description: 'An end-to-end learning platform with a NestJS API, Next.js administration experience, OpenAI-powered quiz generation, LaTeX previews, image uploads, and a MySQL data model for multiple question types.',
        stacks: ["NestJS", "Next.js", "TypeScript", "OpenAI API", "MySQL", "TypeORM", "Docker", "AWS EC2"],
        start_at: '2025.03',
        end_at: '2025.06',
        made_at: 'Key Publishing'
    },
  {
    id: 0,
    image: [
        { type: 'mobile', uri: '/img/co2network/image1.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image2.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image3.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image4.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image5.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image6.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image7.jpeg' },
        { type: 'mobile', uri: '/img/co2network/image8.jpeg' },
    ],
    title: 'CO2Network (UNZN)',
    description:
        'Carbon offsetting iOS app by CO2 Network Inc. Users calculate their personal carbon footprint, offset it by supporting third-party verified climate projects (Verra & Gold Standard), and receive verifiable digital offset certificates. Includes membership tiers (Citizen/Monarch), an integrated wallet, and STO token investment in ESG climate projects toward a net-zero economy.',
    stacks: ["SwiftUI", "Swift", "The Composable Architecture (TCA)", "GraphQL", "Apollo", "AWS AppSync", "Lottie Animations", "CocoaPods", "Apple Connect"],
    start_at: '2024.05',
    end_at: '2024.06',
    made_at: 'CO2NETWORK',
    link: 'https://apps.apple.com/kr/app/co2network/id6450908821?l=en-GB'
},
    {
        id: 6,
        image: [
            { type: 'pc', uri: '/img/co2admin/image1.png' },
            { type: 'pc', uri: '/img/co2admin/image2.png' },
            { type: 'pc', uri: '/img/co2admin/image3.png' },
            { type: 'pc', uri: '/img/co2admin/image4.png' },
            { type: 'pc', uri: '/img/co2admin/image5.png' },
            { type: 'pc', uri: '/img/co2admin/image6.png' },
            { type: 'pc', uri: '/img/co2admin/image7.png' },
            { type: 'pc', uri: '/img/co2admin/image8.png' }
        ],
        title: 'CO2Network Admin',
        description: 'The CO2Network Admin is a comprehensive carbon footprint management tool designed for administrators to oversee user activities within the CO2Network app. Administrators can manage user profiles, monitor carbon footprint calculations, and facilitate investments in projects aimed at offsetting carbon footprints. The platform also supports investments in STO tokens, enabling users to contribute to climate change mitigation efforts.',
        stacks: ["SwiftUI", "Swift", "MVVM", "GraphQL", "Apollo", "AWS AppSync", "Lottie Animations", "CocoaPods", "Apple Connect", "Unlisted App Distribution"],
        start_at: '2024.06',
        end_at: '2024.07',
        made_at: 'CO2NETWORK',
        link: 'https://apps.apple.com/kr/app/co2network/id6450908821?l=en-GB'
    },
    {
        id: 1,
        image: [
            { type: 'pc', uri: '/img/mando/mando1.png' },
            { type: 'mobile', uri: '/img/mando/mando2.png' },
            { type: 'pc', uri: '/img/mando/mando3.png' },
            { type: 'mobile', uri: '/img/mando/mando4.png' },
            { type: 'pc', uri: '/img/mando/mando5.png' },
        ],
        title: 'H2Care Mando',
        description: 'Mando is a user-centric application designed for locating and managing electric car charging stations. Users can search for the nearest charging stations, make reservations, and check their car profiles. The app provides detailed information on the distance traveled and the amount spent on charging. Additionally, users can make payments for charging stations in advance during the reservation process.',
        stacks: ["React.js", "Material-UI", "Styled Components", "Tailwind CSS", "Recoil", "React Query", "Axios", "REST API", "Node.js", "Naver Maps", "Vanilla JavaScript", "AWS"],
        start_at: '2022.07',
        end_at: '2022.11',
        made_at: 'RsInteractive',
        link: 'https://www.hlklemove.com/eng/business/data-solution/H2-care-service.do'
    },
    {
        id: 2,
        image: [
            { type: 'pc', uri: '/img/stories/stories2.png' },
            { type: 'mobile', uri: '/img/stories/stories1.png' },
            { type: 'mobile', uri: '/img/stories/stories3.png' },
            { type: 'mobile', uri: '/img/stories/stories4.png' },
            { type: 'mobile', uri: '/img/stories/stories5.png' },
        ],
        title: 'StoryKorean',
        description: 'StoryKorean is a mobile app designed to facilitate learning the Korean language through engaging quizzes. The app includes a sophisticated quiz generation algorithm that creates customized quizzes to enhance the learning experience. It supports importing quiz data from Excel files and securely stores this data in a robust database. ',
        stacks: ["Node.js", "JavaScript", "Express.js", "REST API", "MySQL", "xlsx", "AWS S3"],
        start_at: '2022.12',
        end_at: '2023.03',
        made_at: 'RsInteractive',
        link: 'https://play.google.com/store/apps/details?id=com.jocdand.storykoreanapp&hl=en&gl=US'
    },

    {
        id: 3,
        image: [
            { type: 'pc', uri: '/img/carfit/carfit1.png' },
            { type: 'pc', uri: '/img/carfit/carfit2.png' },
            { type: 'pc', uri: '/img/carfit/carfit3.png' },
            { type: 'pc', uri: '/img/carfit/carfit4.png' },

        ],
        title: 'Carfit',
        description: ' Development of Admin Website for Carfit Car Rental App',
        stacks: ["React.js", "JavaScript", "Recoil", "React Query", "REST API", "Storybook", "Styled Components"],
        start_at: '2023.02',
        end_at: '2023.03',
        made_at: 'Rs Interactive',
        link:'https://starautomobile.net/BUSINESS03'

    },
    {
        id: 4,
        image: [
        ],
        title: 'DaouSync and DaouSync Desktop App',
        description: 'A synchronized web and cross-platform desktop workspace. I developed responsive React interfaces, Electron and Svelte desktop features, RabbitMQ messaging, macOS native integrations, local SQLite storage, shared components, and API caching.',
        stacks: ["React.js", "Next.js", "Electron.js", "Svelte", "RabbitMQ", "macOS Native APIs", "SQLite3", "Recoil", "React Query", "REST API", "Storybook", "Styled Components"],
        start_at: '2023.03',
        end_at: '2023.07',
        made_at: 'Rs Interactive',
        link:'https://www.daousync.com/'
    },
    {
        id: 8,
        image: [
            { type: 'mobile', uri: '/img/yongin/image6.png' },
            { type: 'mobile', uri: '/img/yongin/image1.jpeg' },
            { type: 'mobile', uri: '/img/yongin/image2.jpeg' },
            { type: 'mobile', uri: '/img/yongin/image3.jpeg' },
            { type: 'mobile', uri: '/img/yongin/image4.png' },

        ],
        title: 'Yongin Severance Hospital',
        description: 'This app allows patients to book, reschedule, and cancel appointments with Yongin Hospital. It provides a calendar view of available slots, notifications for upcoming appointments, and the ability to sync with personal calendars. The app aims to streamline the appointment process, reduce wait times, and improve patient satisfaction.',
        stacks: ["Swift", "Storyboard", "RxSwift", "REST API", "Xcode", "CocoaPods", "Apple Connect", "iOS Notification Extensions"],
        start_at: '2024.01',
        end_at: '2024.02',
        made_at: '4CGate',
        link: "https://apps.apple.com/kr/app/%EC%9A%A9%EC%9D%B8%EC%84%B8%EB%B8%8C%EB%9E%80%EC%8A%A4%EB%B3%91%EC%9B%90/id1505186177"
    },
    {
        id: 9,
        image: [
            { type: 'mobile', uri: '/img/snu/image1.jpeg' },
            { type: 'mobile', uri: '/img/snu/image2.jpeg' },
            { type: 'mobile', uri: '/img/snu/image3.jpeg' },
        ],
        title: 'Bundang SNU Hospital',
        description: 'This web app is designed to integrate with the Kakao Smart Channel for hospitals. It enables patients to book, reschedule, and cancel appointments, as well as manage hospitalization (room booking) with Bundang SNU Hospital. The app offers a calendar view of available slots and sends push notifications through the Kakao channel about upcoming appointments. It aims to streamline the appointment process, reduce wait times, and improve patient satisfaction.',
        stacks: ["React.js", "TypeScript", "Material-UI", "Redux", "Axios", "REST API", "Node.js", "MariaDB", "Oracle", "XML", "Postman"],
        start_at: '2024.05',
        end_at: '2024.06',
        made_at: '4CGate',
        link: 'https://devpac.snubh.org/'
    },
    {
        id: 10,
        image: [
            { type: 'mobile', uri: '/img/bundang/image1.jpeg' },
            { type: 'mobile', uri: '/img/bundang/image2.jpeg' },
            { type: 'mobile', uri: '/img/bundang/image3.jpeg' },
            { type: 'mobile', uri: '/img/bundang/image4.jpeg' },
            { type: 'mobile', uri: '/img/bundang/image5.jpeg' },
            { type: 'mobile', uri: '/img/bundang/image7.jpeg' },
        ],
        title: 'BundangCha Hospital IOS App',
        description: 'This app allows patients to book, reschedule, and cancel appointments with BundangCha Hospital. It provides a calendar view of available slots, notifications for upcoming appointments, and the ability to sync with personal calendars. The app aims to streamline the appointment process, reduce wait times, and improve patient satisfaction.',
        stacks: ["Swift", "Storyboard", "RxSwift", "REST API", "Xcode", "Apple Connect", "iOS Notification Extensions"],
        start_at: '2023.10',
        end_at: '2023.12',
        made_at: '4CGate',
        link: 'https://apps.apple.com/kr/app/분당차병원/id1559162367'
    },
    {
        id: 11,
        image: [
            { type: 'mobile', uri: '/img/jamshil/image1.jpeg' },
            { type: 'mobile', uri: '/img/jamshil/image2.jpeg' },
            { type: 'mobile', uri: '/img/jamshil/image3.jpeg' },
            { type: 'mobile', uri: '/img/jamshil/image4.jpeg' },
            { type: 'mobile', uri: '/img/jamshil/image5.jpeg' },
        ],
        title: 'Jamsilcha Hospital (Hybrid App)',
        description: 'This app allows patients to book, reschedule, and cancel appointments with Jamsilcha Hospital. It provides a calendar view of available slots, notifications for upcoming appointments, and the ability to sync with personal calendars. The app aims to streamline the appointment process, reduce wait times, and improve patient satisfaction.',
        stacks: ["React.js", "Next.js", "Material-UI", "Redux", "React Query", "Axios", "REST API", "Node.js", "MariaDB", "Postman", "Swift", "WebView", "Xcode", "Apple Connect", "iOS Notification Extensions"],
        start_at: '2023.08',
        end_at: '2024.02',
        made_at: '4CGate',
        link: 'https://apps.apple.com/be/app/차-여성의학연구소-잠실센터/id6479238916'
    },


]


export interface ExperienceProps {
    id: number;
    subTitle?: string;
    start_at: string;
    end_at: string;
    title: string;
    description: string;
    links: string[];
    stacks: string[]
    url: string
}

export const EXPERIENCE_LIST: ExperienceProps[] = [
    {
        id: 7,
        start_at: '2026.01',
        end_at: '2026.04',
        url: 'https://zest.im/',
        title: 'Zest',
        description: 'Sole frontend owner for a 3D solar-analysis platform, translating Ladybug, Rhino, and Grasshopper research into an interactive Three.js viewer, model-upload pipeline, and Libre Map context.',
        subTitle: 'Frontend Developer',
        links: [''],
        stacks: ["Next.js", "TypeScript", "Three.js", "Libre Map", "Ladybug", "Rhino", "Grasshopper", "Cursor", "Claude"]
    },
    {
        id: 6,
        start_at: '2025.06',
        end_at: '2026.01',
        url: '#',
        title: 'OMS service Company',
        description: 'Led the frontend of an internal order and inventory management system, progressively migrating jQuery screens to Next.js while improving shared components, UX, API contracts, and release stability.',
        subTitle: 'Frontend Developer',
        links: [''],
        stacks: ["Next.js", "TypeScript", "REST API", "jQuery", "Cursor", "Claude"]
    },
    {
        id: 5,
        start_at: '2025.03',
        end_at: '2025.06',
        title: 'Key Publishing',
        url: '#',
        description: 'Designed a NestJS backend, Next.js admin, MySQL schema, and OpenAI-powered math quiz generator with multiple question formats, LaTeX previews, uploads, and Docker-based deployment.',
        subTitle: 'Backend Developer',
        links: [''],
        stacks: ["NestJS", "Next.js", "OpenAI API", "MySQL", "TypeORM", "Docker", "AWS EC2"]
    },
    {
        id: 4,
        start_at: '2024.08',
        end_at: '2025.02',
        title: 'Next Innovation',
        url: '#',
        description: 'Built five responsive insurance products in a reusable multi-portal Next.js architecture, integrating REST APIs, payments, KYC verification, and automated delivery pipelines.',
        subTitle: 'Frontend Developer',
        links: [''],
        stacks: ["Next.js", "TypeScript", "Tailwind CSS", "Redux", "Recoil", "Jenkins", "GitLab CI/CD"]
    },
    {
        id: 3,
        start_at: '2024.03',
        end_at: '2024.07',
        title: 'CO2 Network',
        url: 'https://co2network.green',
        description: 'Shipped two SwiftUI applications, owning TCA state management, Apollo GraphQL integration, Lottie motion, notification extensions, testing, and App Store delivery while also contributing to React web products.',
        subTitle: 'iOS & Web Frontend Developer',
        links: [''],
        stacks: ["SwiftUI", "Swift", "TCA", "GraphQL", "Apollo", "Lottie", "React", "Next.js"]
    },
    {
        id: 2,
        start_at: '2023.08',
        end_at: '2024.03',
        title: '4CGate',
        url: 'https://www.4cgate.com',
        description: 'Delivered iOS, hybrid, and full-stack healthcare products for major Korean hospitals, including patient apps, booking services, consultation forms, REST APIs, and hospital-system integrations.',
        subTitle: 'iOS & Full-stack Developer',
        links: [''],
        stacks: ["Swift", "RxSwift", "React", "TypeScript", "Node.js", "MariaDB", "Oracle", "XML"]
    },
    {
        id: 1,
        start_at: '2022.07',
        end_at: '2023.08',
        title: 'RS Interactive',
        url: 'https://rsinteractive.co.kr',
        description: 'Built mobility, education, rental, and desktop products across React, Node.js, Electron, and AWS—from EV charging interfaces to real-time desktop synchronization.',
        subTitle: 'Web Developer',
        links: [''],
        stacks: ["React", "Node.js", "Express", "Electron", "Svelte", "RabbitMQ", "MySQL", "AWS S3"]
    }
]
