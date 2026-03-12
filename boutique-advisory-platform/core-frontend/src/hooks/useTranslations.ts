'use client'

import { useState, useEffect } from 'react'

// Inline translations to avoid Turbopack HMR issues with JSON imports
const translations = {
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      submit: "Submit",
      back: "Back",
      next: "Next",
      previous: "Previous",
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      actions: "Actions",
      status: "Status",
      createdAt: "Created At",
      updatedAt: "Updated At",
      overview: "Overview",
      financials: "Financials",
      documents: "Documents",
      portfolio: "Portfolio"
    },
    navigation: {
      dashboard: "Dashboard",
      smes: "SMEs",
      investors: "Investors",
      deals: "Deals",
      advisory: "Advisory",
      reports: "Reports",
      settings: "Settings",
      profile: "Profile",
      logout: "Logout"
    },
    auth: {
      login: "Login",
      register: "Register",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      firstName: "First Name",
      lastName: "Last Name",
      forgotPassword: "Forgot Password?",
      rememberMe: "Remember Me",
      loginSuccess: "Login successful",
      loginError: "Login failed",
      registerSuccess: "Registration successful",
      registerError: "Registration failed"
    },
    home: {
      hero: {
        title: "Bridging",
        sme: "SMEs",
        and: "and",
        investors: "Investors",
        description: "A comprehensive platform connecting Small and Medium Enterprises with qualified investors, featuring advanced DID integration, multi-tenant architecture, and professional advisory services.",
        getStarted: "Get Started",
        viewDemo: "View Demo"
      },
      features: {
        sme: {
          title: "SME Platform",
          description: "Connect SMEs with investors through our comprehensive platform"
        },
        investor: {
          title: "Investor Portal",
          description: "Find and invest in verified SMEs with transparent processes"
        },
        advisory: {
          title: "Advisory Services",
          description: "Professional advisory services for investment readiness"
        },
        security: {
          title: "Security & Compliance",
          description: "Multi-tenant architecture with DID-based authentication"
        },
        analytics: {
          title: "Analytics & Reporting",
          description: "Comprehensive dashboards and performance tracking"
        }
      }
    },
    dashboard: {
      welcome: "Welcome back",
      smeTitle: "SME Dashboard",
      investorTitle: "Investment Dashboard",
      advisorTitle: "Advisor Dashboard",
      adminTitle: "Admin Dashboard",
      recentActivity: "Recent Activity",
      nextSteps: "Next Steps",
      portfolioValue: "Portfolio Value",
      activeInvestments: "Active Investments",
      totalReturns: "Total Returns",
      pendingDeals: "Pending Deals",
      activeCases: "Active Cases",
      smesCertified: "SMEs Certified",
      pendingReviews: "Pending Reviews",
      successRate: "Success Rate"
    },
    advisory: {
      scorecard: "Boutique Advisory Scorecard",
      assessment: "Due Diligence Assessment",
      finalize: "FINALIZE & CERTIFY",
      saveDraft: "SAVE DRAFT",
      manageAssessment: "MANAGE ASSESSMENT",
      certified: "CERTIFIED",
      pending: "PENDING CERTIFICATION",
      pipeline: "SME Pipeline",
      manualMatch: "Create Manual Match",
      kycVerified: "KYC VERIFIED",
      kycPending: "KYC PENDING",
      expressInterest: "Express Interest",
      certifySME: "Certify SME",
      createDeal: "Create Deal"
    },
    smeProfile: {
      basicInfo: "Basic Information",
      contactInfo: "Contact Information",
      businessDescription: "Business Description",
      registrationNumber: "Registration Number",
      taxId: "Tax ID",
      founded: "Founded",
      employees: "Employees",
      annualRevenue: "Annual Revenue",
      fundingRequired: "Funding Required",
      valueProposition: "Value Proposition",
      targetMarket: "Target Market",
      competitiveAdvantage: "Competitive Advantage"
    }
  },
  km: {
    common: {
      loading: "កំពុងផ្ទុក...",
      error: "កំហុស",
      success: "ជោគជ័យ",
      save: "រក្សាទុក",
      cancel: "បោះបង់",
      delete: "លុប",
      edit: "កែប្រែ",
      view: "មើល",
      submit: "ដាក់ស្នើ",
      back: "ត្រឡប់",
      next: "បន្ទាប់",
      previous: "មុន",
      search: "ស្វែងរក",
      filter: "ត្រង",
      sort: "តម្រៀប",
      actions: "សកម្មភាព",
      status: "ស្ថានភាព",
      createdAt: "បង្កើតនៅថ្ងៃទី",
      updatedAt: "ធ្វើបច្ចុប្បន្នភាពនៅថ្ងៃទី",
      overview: "ទិដ្ឋភាពទូទៅ",
      financials: "ហិរញ្ញវត្ថុ",
      documents: "ឯកសារ",
      portfolio: "ផលប័ត្រ"
    },
    navigation: {
      dashboard: "ផ្ទាំងគ្រប់គ្រង",
      smes: "សហគ្រាសតូចនិងមធ្យម",
      investors: "អ្នកវិនិយោគ",
      deals: "កិច្ចព្រមព្រៀង",
      advisory: "ណែនាំ",
      reports: "របាយការណ៍",
      settings: "ការកំណត់",
      profile: "ប្រវត្តិរូប",
      logout: "ចាកចេញ"
    },
    auth: {
      login: "ចូល",
      register: "ចុះឈ្មោះ",
      email: "អ៊ីមែល",
      password: "ពាក្យសម្ងាត់",
      confirmPassword: "បញ្ជាក់ពាក្យសម្ងាត់",
      firstName: "ឈ្មោះ",
      lastName: "នាមត្រកូល",
      forgotPassword: "ភ្លេចពាក្យសម្ងាត់?",
      rememberMe: "ចងចាំខ្ញុំ",
      loginSuccess: "ចូលបានជោគជ័យ",
      loginError: "ចូលបរាជ័យ",
      registerSuccess: "ចុះឈ្មោះបានជោគជ័យ",
      registerError: "ចុះឈ្មោះបរាជ័យ"
    },
    home: {
      hero: {
        title: "ការតភ្ជាប់",
        sme: "សហគ្រាសតូចនិងមធ្យម",
        and: "និង",
        investors: "អ្នកវិនិយោគ",
        description: "វេទិកាប្រកបដោយភាពទូលំទូលសម្រាប់ភ្ជាប់សហគ្រាសតូចនិងមធ្យមជាមួយអ្នកវិនិយោគដែលមានលក្ខណៈសម្បត្តិ ដែលមានការតភ្ជាប់ DID កម្រិតខ្ពស់ នីតិវិធីអតិថិជនច្រើន និងសេវាកម្មណែនាំវិជ្ជាជីវៈ។",
        getStarted: "ចាប់ផ្តើម",
        viewDemo: "មើលឧទារហរណ៍"
      },
      features: {
        sme: {
          title: "វេទិកាសហគ្រាសតូចនិងមធ្យម",
          description: "ភ្ជាប់សហគ្រាសតូចនិងមធ្យមជាមួយអ្នកវិនិយោគតាមរយៈវេទិកាប្រកបដោយភាពទូលំទូលរបស់យើង"
        },
        investor: {
          title: "វិបផតថលអ្នកវិនិយោគ",
          description: "ស្វែងរកនិងវិនិយោគក្នុងសហគ្រាសតូចនិងមធ្យមដែលបានផ្ទៀងផ្ទាត់ជាមួយនីតិវិធីភាពថ្លា"
        },
        advisory: {
          title: "សេវាកម្មណែនាំ",
          description: "សេវាកម្មណែនាំវិជ្ជាជីវៈសម្រាប់ការត្រៀមខ្លួនវិនិយោគ"
        },
        security: {
          title: "សុវត្ថិភាព និងការអនុលោមតាម",
          description: "នីតិវិធីអតិថិជនច្រើនជាមួយការផ្ទៀងផ្ទាត់អត្តសញ្ញាណ៍ផ្អែកលើ DID"
        },
        analytics: {
          title: "ការវិភាគ និងរបាយការណ៍",
          description: "ផ្ទាំងគ្រប់គ្រងប្រកបដោយភាពទូលំទូល និងការតាមដានដំណើរការ"
        }
      }
    },
    dashboard: {
      welcome: "សូមស្វាគមន៍មកវិញ",
      smeTitle: "ផ្ទាំងគ្រប់គ្រងសហគ្រាស",
      investorTitle: "ផ្ទាំងគ្រប់គ្រងការវិនិយោគ",
      advisorTitle: "ផ្ទាំងគ្រប់គ្រងអ្នកប្រឹក្សា",
      adminTitle: "ផ្ទាំងគ្រប់គ្រងអ្នកគ្រប់គ្រង",
      recentActivity: "សកម្មភាពថ្មីៗ",
      nextSteps: "ជំហានបន្ទាប់",
      portfolioValue: "តម្លៃផលប័ត្រ",
      activeInvestments: "ការវិនិយោគសកម្ម",
      totalReturns: "ប្រាក់ចំណេញសរុប",
      pendingDeals: "កិច្ចព្រមព្រៀងកំពុងរង់ចាំ",
      activeCases: "ករណីសកម្ម",
      smesCertified: "សហគ្រាសដែលបានបញ្ជាក់",
      pendingReviews: "ការពិនិត្យឡើងវិញកំពុងរង់ចាំ",
      successRate: "អត្រាជោគជ័យ"
    },
    advisory: {
      scorecard: "តារាងពិន្ទុប្រឹក្សាយោបល់",
      assessment: "ការវាយតម្លៃ Due Diligence",
      finalize: "បញ្ចប់ និងបញ្ជាក់",
      saveDraft: "រក្សាទុកព្រាង",
      manageAssessment: "គ្រប់គ្រងការវាយតម្លៃ",
      certified: "បានបញ្ជាក់",
      pending: "កំពុងរង់ចាំការបញ្ជាក់",
      pipeline: "បញ្ជីសហគ្រាស",
      manualMatch: "បង្កើតការផ្គូផ្គងដោយដៃ",
      kycVerified: "KYC បានផ្ទៀងផ្ទាត់",
      kycPending: "KYC កំពុងរង់ចាំ",
      expressInterest: "បង្ហាញការចាប់អារម្មណ៍",
      certifySME: "បញ្ជាក់សហគ្រាស",
      createDeal: "បង្កើតកិច្ចព្រមព្រៀង"
    },
    smeProfile: {
      basicInfo: "ព័ត៌មានមូលដ្ឋាន",
      contactInfo: "ព័ត៌មានទំនាក់ទំនង",
      businessDescription: "ការពិពណ៌នាអំពីអាជីវកម្ម",
      registrationNumber: "លេខចុះបញ្ជី",
      taxId: "លេខអត្តសញ្ញាណកម្មពន្ធ",
      founded: "បង្កើតឡើងនៅ",
      employees: "បុគ្គលិក",
      annualRevenue: "ចំណូលប្រចាំឆ្នាំ",
      fundingRequired: "តម្រូវការហិរញ្ញប្បទាន",
      valueProposition: "គុណតម្លៃនៃអាជីវកម្ម",
      targetMarket: "ទីផ្សារគោលដៅ",
      competitiveAdvantage: "គុណសម្បត្តិប្រកួតប្រជែង"
    }
  },
  zh: {
    common: {
      loading: "加载中...",
      error: "错误",
      success: "成功",
      save: "保存",
      cancel: "取消",
      delete: "删除",
      edit: "编辑",
      view: "查看",
      submit: "提交",
      back: "返回",
      next: "下一步",
      previous: "上一步",
      search: "搜索",
      filter: "筛选",
      sort: "排序",
      actions: "操作",
      status: "状态",
      createdAt: "创建时间",
      updatedAt: "更新时间",
      overview: "概览",
      financials: "财务",
      documents: "文档",
      portfolio: "投资组合"
    },
    navigation: {
      dashboard: "仪表板",
      smes: "中小企业",
      investors: "投资者",
      deals: "交易",
      advisory: "咨询",
      reports: "报告",
      settings: "设置",
      profile: "个人资料",
      logout: "退出登录"
    },
    auth: {
      login: "登录",
      register: "注册",
      email: "邮箱",
      password: "密码",
      confirmPassword: "确认密码",
      firstName: "名字",
      lastName: "姓氏",
      forgotPassword: "忘记密码？",
      rememberMe: "记住我",
      loginSuccess: "登录成功",
      loginError: "登录失败",
      registerSuccess: "注册成功",
      registerError: "注册失败"
    },
    home: {
      hero: {
        title: "连接",
        sme: "中小企业",
        and: "和",
        investors: "投资者",
        description: "一个连接中小企业和合格投资者的综合平台，具有先进的DID集成、多租户架构和专业咨询服务。",
        getStarted: "开始使用",
        viewDemo: "查看演示"
      },
      features: {
        sme: {
          title: "中小企业平台",
          description: "通过我们的综合平台连接中小企业和投资者"
        },
        investor: {
          title: "投资者门户",
          description: "通过透明流程寻找和投资经过验证的中小企业"
        },
        advisory: {
          title: "咨询服务",
          description: "投资准备的专业咨询服务"
        },
        security: {
          title: "安全和合规",
          description: "具有基于DID身份验证的多租户架构"
        },
        analytics: {
          title: "分析和报告",
          description: "综合仪表板和性能跟踪"
        }
      }
    },
    dashboard: {
      welcome: "欢迎回来",
      smeTitle: "中小企业仪表板",
      investorTitle: "投资仪表板",
      advisorTitle: "顾问仪表板",
      adminTitle: "管理员仪表板",
      recentActivity: "最近活动",
      nextSteps: "下一步",
      portfolioValue: "投资组合价值",
      activeInvestments: "活跃投资",
      totalReturns: "总回报",
      pendingDeals: "待处理交易",
      activeCases: "活跃案例",
      smesCertified: "已认证中小企业",
      pendingReviews: "待处理评估",
      successRate: "成功率"
    },
    advisory: {
      scorecard: "咨询评分卡",
      assessment: "尽职调查评估",
      finalize: "完成并认证",
      saveDraft: "保存草稿",
      manageAssessment: "管理评估",
      certified: "已认证",
      pending: "待认证",
      pipeline: "中小企业渠道",
      manualMatch: "创建手动匹配",
      kycVerified: "KYC 已验证",
      kycPending: "KYC 待处理",
      expressInterest: "表达兴趣",
      certifySME: "认证中小企业",
      createDeal: "创建交易"
    },
    smeProfile: {
      basicInfo: "基本信息",
      contactInfo: "联系信息",
      businessDescription: "业务描述",
      registrationNumber: "注册号",
      taxId: "税务识别号",
      founded: "成立日期",
      employees: "员工人数",
      annualRevenue: "年收入",
      fundingRequired: "所需资金",
      valueProposition: "价值主张",
      targetMarket: "目标市场",
      competitiveAdvantage: "竞争优势"
    }
  }
}

export function useTranslations() {
  const [currentLanguage, setCurrentLanguage] = useState('en')

  useEffect(() => {
    // Get language from localStorage or default to 'en'
    const savedLanguage = localStorage.getItem('selectedLanguage') || 'en'
    setCurrentLanguage(savedLanguage)

    // Listen for language changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleLanguageChange = (e: CustomEvent<any>) => {
      setCurrentLanguage(e.detail.language)
    }

    window.addEventListener('languageChanged', handleLanguageChange as EventListener)

    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener)
    }
  }, [])

  const t = (key: string, fallback?: string): string => {
    const keys = key.split('.')
    let value = translations[currentLanguage as keyof typeof translations]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value = (value as any)[k]
      } else {
        return fallback || key
      }
    }

    return (value as unknown as string) || fallback || key
  }

  return { t, currentLanguage }
}
