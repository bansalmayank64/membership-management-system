import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      nav: {
        students: "Students",
        payments: "Payments",
        expenses: "Expenses",
        expiringMemberships: "Expiring Memberships",
        studentProfile: "Student Profile",
        contactUs: "Contact Us"
      },
      // Common
      common: {
        search: "Search",
        filter: "Filter",
        sort: "Sort",
        edit: "Edit",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        add: "Add",
        close: "Close",
        refresh: "Refresh",
        loading: "Loading...",
        error: "Error",
        success: "Success",
        actions: "Actions",
        total: "Total",
        amount: "Amount",
        date: "Date",
        status: "Status",
        active: "Active",
        expired: "Expired",
        expiringSoon: "Expiring Soon",
        all: "All",
        rowsPerPage: "Rows per page:"
      },
      // Students page
      students: {
        title: "Student Directory",
        subtitle: "Manage and view all registered students",
        searchPlaceholder: "Search by name, seat number, or contact...",
        addStudent: "Add Student",
        totalStudents: "Total Students",
        activeMemberships: "Active Memberships",
        expiredMemberships: "Expired Memberships",
        expiringSoon: "Expiring Soon",
        id: "Student ID",
        seatNumber: "Seat Number",
        name: "Name",
        fatherName: "Father's Name",
        contact: "Contact",
        membershipStatus: "Membership Status",
        totalPaid: "Total Paid",
        editStudent: "Edit Student",
        addPayment: "Add Payment",
        paymentHistory: "Payment History",
        noStudentsFound: "No students found",
        noStudentsMatch: "No students found matching your search criteria"
      },
      // Payment related
      payment: {
        addPayment: "Add Payment",
        addRefund: "Add Refund",
        extendMembership: "Extend Membership",
        paymentHistory: "Payment History",
        paymentMode: "Payment Mode",
        paymentDate: "Payment Date",
        extensionDate: "Extension Date",
        extendByMonths: "Extend by (months)",
        reason: "Reason",
        reasonOptional: "Reason (optional)",
        reasonPlaceholder: "e.g., Complimentary extension",
        receiptId: "Receipt ID",
        noPaymentHistory: "No Payment History",
        noPaymentsRecorded: "No payments have been recorded for this student yet.",
        type: "Type",
        payment: "Payment",
        refund: "Refund",
        modes: {
          cash: "Cash",
          online: "Online",
          card: "Card",
          upi: "UPI",
          bankTransfer: "Bank Transfer"
        }
      },
      // Edit student
      editStudent: {
        title: "Edit Student Details",
        studentName: "Student Name",
        contactNumber: "Contact Number",
        gender: "Gender",
        saveChanges: "Save Changes",
        genders: {
          male: "Male",
          female: "Female",
          other: "Other"
        }
      },
      // Contact page
      contact: {
        title: "Contact Us",
        subtitle: "Get in touch with us for any queries or support",
        address: "Address",
        phone: "Phone",
        email: "Email",
        hours: "Operating Hours",
        getInTouch: "Get in Touch",
        sendMessage: "Send Message",
        yourName: "Your Name",
        yourEmail: "Your Email",
        subject: "Subject",
        message: "Message"
      },
      // Expiring memberships
      expiring: {
        title: "Expiring Memberships",
        subtitle: "Students whose memberships are expiring soon",
        expiringIn: "Expiring in",
        days: "days",
        day: "day",
        today: "today",
        expired: "Expired",
        extendMembership: "Extend Membership",
        contactStudent: "Contact Student"
      }
    }
  },
  hi: {
    translation: {
      // Navigation
      nav: {
        students: "छात्र",
        payments: "भुगतान",
        expenses: "खर्च",
        expiringMemberships: "समाप्त होती सदस्यता",
        studentProfile: "छात्र प्रोफ़ाइल",
        contactUs: "संपर्क करें"
      },
      // Common
      common: {
        search: "खोजें",
        filter: "फ़िल्टर",
        sort: "क्रमबद्ध करें",
        edit: "संपादित करें",
        save: "सेव करें",
        cancel: "रद्द करें",
        delete: "हटाएं",
        add: "जोड़ें",
        close: "बंद करें",
        refresh: "रीफ्रेश करें",
        loading: "लोड हो रहा है...",
        error: "त्रुटि",
        success: "सफलता",
        actions: "क्रियाएं",
        total: "कुल",
        amount: "राशि",
        date: "दिनांक",
        status: "स्थिति",
        active: "सक्रिय",
        expired: "समाप्त",
        expiringSoon: "जल्द समाप्त",
        all: "सभी",
        rowsPerPage: "प्रति पृष्ठ पंक्तियां:"
      },
      // Students page
      students: {
        title: "छात्र निर्देशिका",
        subtitle: "सभी पंजीकृत छात्रों को प्रबंधित और देखें",
        searchPlaceholder: "नाम, सीट नंबर या संपर्क से खोजें...",
        addStudent: "छात्र जोड़ें",
        totalStudents: "कुल छात्र",
        activeMemberships: "सक्रिय सदस्यता",
        expiredMemberships: "समाप्त सदस्यता",
        expiringSoon: "जल्द समाप्त",
        id: "छात्र आईडी",
        seatNumber: "सीट नंबर",
        name: "नाम",
        fatherName: "पिता का नाम",
        contact: "संपर्क",
        membershipStatus: "सदस्यता स्थिति",
        totalPaid: "कुल भुगतान",
        editStudent: "छात्र संपादित करें",
        addPayment: "भुगतान जोड़ें",
        paymentHistory: "भुगतान इतिहास",
        noStudentsFound: "कोई छात्र नहीं मिला",
        noStudentsMatch: "आपकी खोज मानदंडों से मेल खाने वाला कोई छात्र नहीं मिला"
      },
      // Payment related
      payment: {
        addPayment: "भुगतान जोड़ें",
        addRefund: "रिफंड जोड़ें",
        extendMembership: "सदस्यता बढ़ाएं",
        paymentHistory: "भुगतान इतिहास",
        paymentMode: "भुगतान मोड",
        paymentDate: "भुगतान दिनांक",
        extensionDate: "विस्तार दिनांक",
        extendByMonths: "महीनों में बढ़ाएं",
        reason: "कारण",
        reasonOptional: "कारण (वैकल्पिक)",
        reasonPlaceholder: "जैसे, मुफ्त विस्तार",
        receiptId: "रसीद आईडी",
        noPaymentHistory: "कोई भुगतान इतिहास नहीं",
        noPaymentsRecorded: "इस छात्र के लिए अभी तक कोई भुगतान दर्ज नहीं किया गया है।",
        type: "प्रकार",
        payment: "भुगतान",
        refund: "रिफंड",
        modes: {
          cash: "नकद",
          online: "ऑनलाइन",
          card: "कार्ड",
          upi: "यूपीआई",
          bankTransfer: "बैंक ट्रांसफर"
        }
      },
      // Edit student
      editStudent: {
        title: "छात्र विवरण संपादित करें",
        studentName: "छात्र का नाम",
        contactNumber: "संपर्क नंबर",
        gender: "लिंग",
        saveChanges: "परिवर्तन सेव करें",
        genders: {
          male: "पुरुष",
          female: "महिला",
          other: "अन्य"
        }
      },
      // Contact page
      contact: {
        title: "संपर्क करें",
        subtitle: "किसी भी प्रश्न या सहायता के लिए हमसे संपर्क करें",
        address: "पता",
        phone: "फोन",
        email: "ईमेल",
        hours: "कार्य समय",
        getInTouch: "संपर्क में रहें",
        sendMessage: "संदेश भेजें",
        yourName: "आपका नाम",
        yourEmail: "आपका ईमेल",
        subject: "विषय",
        message: "संदेश"
      },
      // Expiring memberships
      expiring: {
        title: "समाप्त होती सदस्यता",
        subtitle: "वे छात्र जिनकी सदस्यता जल्द समाप्त हो रही है",
        expiringIn: "समाप्त होने में",
        days: "दिन",
        day: "दिन",
        today: "आज",
        expired: "समाप्त",
        extendMembership: "सदस्यता बढ़ाएं",
        contactStudent: "छात्र से संपर्क करें"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
