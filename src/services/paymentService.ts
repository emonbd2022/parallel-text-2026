import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PaymentRecord, AppNotification } from '../types';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';

export const SUBSCRIPTION_PRICE_BDT = 200;
export const PAYMENT_PHONE_NUMBER = '01601934495';
export const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/C99DVij6wM5A7NRawDARYM?s=cl&p=a&mlu=4&ilr=4';

/**
 * Submits a new bKash / Nagad payment request and alerts the admin.
 */
export async function submitSubscriptionPayment(params: {
  userId: string;
  userEmail: string;
  userName: string;
  trxId: string;
  method: 'bkash' | 'nagad';
}): Promise<PaymentRecord> {
  const cleanTrxId = params.trxId.trim().toUpperCase();
  if (!cleanTrxId || cleanTrxId.length < 3) {
    throw new Error('Please enter a valid Transaction ID (TrxID).');
  }

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const nowISO = now.toISOString();

  const paymentRecord: PaymentRecord = {
    id: paymentId,
    userId: params.userId,
    userEmail: params.userEmail,
    userName: params.userName,
    amount: SUBSCRIPTION_PRICE_BDT,
    method: params.method,
    trxId: cleanTrxId,
    status: 'pending',
    plan: 'unlimited',
    durationDays: 30,
    createdAt: nowISO
  };

  const notifId = `notif_${paymentId}`;
  const methodLabel = params.method === 'bkash' ? 'bKash' : 'Nagad';
  const notificationData: AppNotification = {
    id: notifId,
    targetUid: 'admin',
    type: 'subscription_request',
    message: `New Subscription Payment (৳${SUBSCRIPTION_PRICE_BDT}/Month)\nUser: ${params.userName} (${params.userEmail})\nMethod: ${methodLabel}\nTrxID: ${cleanTrxId}\nReference: User Email`,
    userName: params.userName,
    userEmail: params.userEmail,
    createdAt: nowISO,
    read: false,
    paymentId,
    trxId: cleanTrxId,
    amount: SUBSCRIPTION_PRICE_BDT,
    method: params.method,
    userUid: params.userId
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'payments', paymentId), paymentRecord);
  batch.set(doc(db, 'notifications', notifId), notificationData);
  await batch.commit();

  recordFirestoreWrite('payments', 1, 'paymentService:submitPayment');
  recordFirestoreWrite('notifications', 1, 'paymentService:createAdminPaymentNotif');

  return paymentRecord;
}

/**
 * Admin approves a payment request and grants 1 month of unlimited processing.
 */
export async function approveSubscriptionPayment(params: {
  payment?: PaymentRecord;
  paymentId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  trxId?: string;
  amount?: number;
  method?: 'bkash' | 'nagad';
  adminEmail: string;
}): Promise<{ expiresAt: string }> {
  let payId = params.payment?.id || params.paymentId;
  let uId = params.payment?.userId || params.userId;
  let uEmail = params.payment?.userEmail || params.userEmail || '';
  let uName = params.payment?.userName || params.userName || 'User';
  let tId = params.payment?.trxId || params.trxId || '';
  let amt = params.payment?.amount || params.amount || SUBSCRIPTION_PRICE_BDT;
  let pMethod = params.payment?.method || params.method || 'bkash';

  if (!payId) {
    throw new Error('Payment ID is required.');
  }

  // If userId or other fields are missing, fetch payment doc from Firestore
  if (!uId || !uEmail) {
    try {
      const paySnap = await getDoc(doc(db, 'payments', payId));
      if (paySnap.exists()) {
        const d = paySnap.data() as PaymentRecord;
        uId = d.userId || uId;
        uEmail = d.userEmail || uEmail;
        uName = d.userName || uName;
        tId = d.trxId || tId;
        amt = d.amount || amt;
        pMethod = d.method || pMethod;
      }
    } catch (e) {
      console.warn("Could not fetch payment doc:", e);
    }
  }

  if (!uId) {
    throw new Error('User ID is required to approve subscription.');
  }

  const now = new Date();
  const expiresAtDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const nowISO = now.toISOString();
  const expiresAtISO = expiresAtDate.toISOString();

  const batch = writeBatch(db);

  // 1. Update Payment Record
  const paymentRef = doc(db, 'payments', payId);
  batch.update(paymentRef, {
    status: 'approved',
    approvedAt: nowISO,
    expiresAt: expiresAtISO,
    adminNote: `Approved by ${params.adminEmail}`
  });

  // 2. Update User Account to Unlimited for 30 Days
  const userRef = doc(db, 'users', uId);
  batch.update(userRef, {
    unlimited: true,
    plan: 'unlimited',
    planStartDate: nowISO,
    planEndDate: expiresAtISO,
    subscriptionExpiresAt: expiresAtISO,
    credits: 999999
  });

  // 3. Send Notification to User
  const userNotifId = `notif_appr_${payId}`;
  const userNotif: AppNotification = {
    id: userNotifId,
    targetUid: uId,
    type: 'subscription_approved',
    message: `🎉 Your ৳${amt} Unlimited Plan has been approved!\nYou now have Unlimited Processing valid for 1 month until ${expiresAtDate.toLocaleDateString()}. Thank you for supporting Parallel Text!`,
    userName: uName,
    userEmail: uEmail,
    createdAt: nowISO,
    read: false,
    paymentId: payId,
    trxId: tId,
    amount: amt,
    method: pMethod
  };
  batch.set(doc(db, 'notifications', userNotifId), userNotif);

  // 4. Mark admin notification as read
  const adminNotifId = `notif_${payId}`;
  try {
    batch.update(doc(db, 'notifications', adminNotifId), {
      read: true
    });
  } catch {}

  await batch.commit();

  recordFirestoreWrite('payments', 1, 'paymentService:approvePayment');
  recordFirestoreWrite('users', 1, 'paymentService:grantUnlimited');
  recordFirestoreWrite('notifications', 2, 'paymentService:notifyUserAndMarkRead');

  return { expiresAt: expiresAtISO };
}

/**
 * Admin rejects a payment request.
 */
export async function rejectSubscriptionPayment(params: {
  payment?: PaymentRecord;
  paymentId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  trxId?: string;
  reason?: string;
  adminEmail: string;
}): Promise<void> {
  let payId = params.payment?.id || params.paymentId;
  let uId = params.payment?.userId || params.userId;
  let uEmail = params.payment?.userEmail || params.userEmail || '';
  let uName = params.payment?.userName || params.userName || 'User';
  let tId = params.payment?.trxId || params.trxId || '';

  if (!payId) {
    throw new Error('Payment ID is required.');
  }

  if (!uId) {
    try {
      const paySnap = await getDoc(doc(db, 'payments', payId));
      if (paySnap.exists()) {
        const d = paySnap.data() as PaymentRecord;
        uId = d.userId || uId;
        uEmail = d.userEmail || uEmail;
        uName = d.userName || uName;
        tId = d.trxId || tId;
      }
    } catch {}
  }

  const nowISO = new Date().toISOString();
  const reasonText = params.reason || 'TrxID could not be verified or payment was not received';

  const batch = writeBatch(db);

  const paymentRef = doc(db, 'payments', payId);
  batch.update(paymentRef, {
    status: 'rejected',
    rejectedAt: nowISO,
    rejectionReason: reasonText,
    adminNote: `Rejected by ${params.adminEmail}`
  });

  // Send explanation notification to user
  if (uId) {
    const userNotifId = `notif_rej_${payId}`;
    const userNotif: AppNotification = {
      id: userNotifId,
      targetUid: uId,
      type: 'subscription_rejected',
      message: `Payment request (TrxID: ${tId}) could not be verified.\nReason: ${reasonText}.\nFor help, please contact us on WhatsApp community.`,
      userName: uName,
      userEmail: uEmail,
      createdAt: nowISO,
      read: false,
      paymentId: payId,
      trxId: tId
    };
    batch.set(doc(db, 'notifications', userNotifId), userNotif);
  }

  // Mark admin notification as read
  const adminNotifId = `notif_${payId}`;
  try {
    batch.update(doc(db, 'notifications', adminNotifId), {
      read: true
    });
  } catch {}

  await batch.commit();

  recordFirestoreWrite('payments', 1, 'paymentService:rejectPayment');
  recordFirestoreWrite('notifications', uId ? 2 : 1, 'paymentService:notifyUserRejected');
}

/**
 * Fetches all payment records for a specific user.
 */
export async function getUserPayments(userId: string): Promise<PaymentRecord[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('payments', snap.docs.length || 1, 'paymentService:getUserPayments');
    return snap.docs.map(d => d.data() as PaymentRecord);
  } catch (err: any) {
    // Fallback without compound index if needed
    try {
      const qFallback = query(
        collection(db, 'payments'),
        where('userId', '==', userId),
        limit(50)
      );
      const snap = await getDocs(qFallback);
      const items = snap.docs.map(d => d.data() as PaymentRecord);
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return items;
    } catch {
      return [];
    }
  }
}

/**
 * Fetches all payment records for admin overview.
 */
export async function getAllPayments(): Promise<PaymentRecord[]> {
  try {
    const q = query(
      collection(db, 'payments'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    recordFirestoreRead('payments', snap.docs.length || 1, 'paymentService:getAllPayments');
    return snap.docs.map(d => d.data() as PaymentRecord);
  } catch (err: any) {
    console.error("Error fetching all payments:", err);
    return [];
  }
}
