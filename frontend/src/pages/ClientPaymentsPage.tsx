import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Download,
  Edit3,
  Trash2,
  Calendar,
  Building2,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Percent,
  Printer,
  FileText,
  Copy,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  Client,
  ClientPayment,
  NavTab,
  PaymentMethod,
  PaymentStatus,
  PaymentsSummary,
  PaymentInvoice,
  Project,
  ProjectPaymentGroup,
} from '../types/crm';
import {
  exportToCsv,
  formatCurrency,
  formatDate,
  getPaymentStatusBadge,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  toInputDate,
} from '../lib/utils';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface ClientPaymentsPageProps {
  initialProjectId?: string | null;
  onClearInitialId?: () => void;
  onNavigate: (tab: NavTab, contextId?: string) => void;
}

function generatePrintableInvoiceHtml(inv: PaymentInvoice): string {
  const isPaid = inv.status === 'Paid';
  const subtotalFmt = formatCurrency(inv.subtotal, inv.phase.currency);
  const totalFmt = formatCurrency(inv.total_amount, inv.phase.currency);
  const paidFmt = formatCurrency(inv.paid_amount, inv.phase.currency);
  const balanceFmt = formatCurrency(inv.balance_due, inv.phase.currency);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${inv.invoice_number} - ${inv.client.company}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #f8fafc;
      padding: 32px 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 48px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F2547;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #0F2547;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .company-meta {
      font-size: 11px;
      color: #475569;
      margin-top: 8px;
      line-height: 1.6;
    }
    .invoice-title-block {
      text-align: right;
    }
    .doc-type {
      font-size: 20px;
      font-weight: 800;
      color: #0F2547;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .inv-number {
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: #3596B0;
      margin-top: 4px;
    }
    .dates-block {
      margin-top: 8px;
      font-size: 11px;
      color: #64748b;
      line-height: 1.6;
    }
    .stamp-badge {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stamp-paid {
      background: #ecfdf5;
      color: #047857;
      border: 1.5px solid #10b981;
    }
    .stamp-invoiced {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1.5px solid #3b82f6;
    }
    .stamp-pending {
      background: #f8fafc;
      color: #475569;
      border: 1.5px solid #94a3b8;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .meta-box-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0F2547;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table th {
      background: #0F2547;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      text-align: left;
    }
    .table th.text-right { text-align: right; }
    .table td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      font-size: 12px;
    }
    .table td.text-right { text-align: right; }
    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 12px;
      font-size: 12px;
    }
    .totals-table td.amount {
      text-align: right;
      font-weight: 600;
    }
    .totals-table tr.grand-total td {
      font-size: 14px;
      font-weight: 800;
      color: #0F2547;
      border-top: 2px solid #0F2547;
      border-bottom: 2px solid #0F2547;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    .receipt-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .receipt-title {
      font-size: 12px;
      font-weight: 800;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .receipt-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      font-size: 11px;
    }
    .receipt-item label {
      color: #15803d;
      font-weight: 600;
      display: block;
      margin-bottom: 2px;
    }
    .receipt-item span {
      color: #14532d;
      font-weight: 700;
      font-family: monospace;
    }
    .bank-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 11px;
      margin-bottom: 28px;
    }
    .bank-box-title {
      font-weight: 700;
      color: #0F2547;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-size: 11px;
      color: #64748b;
    }
    .signatory {
      text-align: right;
    }
    .signatory-line {
      width: 180px;
      border-bottom: 1px dashed #94a3b8;
      margin-bottom: 4px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      @page { size: A4; margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand-title">${inv.company.name}</div>
        <div class="brand-subtitle">${inv.company.tagline || 'Enterprise AI & Cloud Infrastructure'}</div>
        <div class="company-meta">
          ${inv.company.address}<br>
          GSTIN: <strong>${inv.company.gstin || '33AABCN8291M1ZP'}</strong> &bull; PAN: <strong>${inv.company.pan || 'AABCN8291M'}</strong><br>
          Email: ${inv.company.email} &bull; Web: ${inv.company.website}
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="doc-type">Tax Invoice</div>
        <div class="inv-number">${inv.invoice_number}</div>
        <div class="dates-block">
          Date: <strong>${formatDate(inv.issue_date)}</strong><br>
          Due Date: <strong>${formatDate(inv.due_date)}</strong>
        </div>
        <div class="stamp-badge ${isPaid ? 'stamp-paid' : inv.status === 'Invoiced' ? 'stamp-invoiced' : 'stamp-pending'}">
          ${isPaid ? '&#10003; PAID IN FULL' : inv.status.toUpperCase()}
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-box">
        <div class="meta-box-title">Billed To (Client)</div>
        <div style="font-size: 13px; font-weight: 700; color: #0F2547;">${inv.client.company}</div>
        ${inv.client.contact_name ? `<div style="font-size: 11px; font-weight: 600; margin-top: 2px;">Attn: ${inv.client.contact_name}</div>` : ''}
        ${inv.client.address ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${inv.client.address}</div>` : ''}
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
          ${inv.client.email ? `Email: ${inv.client.email}` : ''}
          ${inv.client.phone ? ` &bull; Phone: ${inv.client.phone}` : ''}
        </div>
      </div>

      <div class="meta-box">
        <div class="meta-box-title">Project Engagement</div>
        <div style="font-size: 13px; font-weight: 700; color: #0F2547;">${inv.project.name}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Service: <strong>${inv.project.service_type || 'Custom Software'}</strong></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Milestone: <strong>Phase ${inv.phase.phase_number} (${inv.phase.percentage}%)</strong></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Contract Value: <strong>${formatCurrency(inv.project.budget || inv.subtotal, inv.phase.currency)}</strong></div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th style="width: 50%;">Milestone Deliverable Scope</th>
          <th style="width: 15%;" class="text-right">Share (%)</th>
          <th style="width: 15%;" class="text-right">Unit Price</th>
          <th style="width: 20%;" class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 700; color: #0F2547; font-size: 13px;">${inv.phase.phase_name}</div>
            ${inv.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${inv.notes}</div>` : '<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Milestone sign-off & deliverables completed as per project agreement.</div>'}
          </td>
          <td class="text-right font-medium">${inv.phase.percentage}%</td>
          <td class="text-right font-medium">${subtotalFmt}</td>
          <td class="text-right" style="font-weight: 700; color: #0F2547;">${subtotalFmt}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-area">
      <table class="totals-table">
        <tr>
          <td>Milestone Subtotal:</td>
          <td class="amount">${subtotalFmt}</td>
        </tr>
        ${inv.tax_rate > 0 ? `
          <tr>
            <td>CGST (${inv.cgst_rate || 9}%):</td>
            <td class="amount">${formatCurrency(inv.cgst_amount || Math.round(inv.tax_amount / 2), inv.phase.currency)}</td>
          </tr>
          <tr>
            <td>SGST (${inv.sgst_rate || 9}%):</td>
            <td class="amount">${formatCurrency(inv.sgst_amount || Math.round(inv.tax_amount / 2), inv.phase.currency)}</td>
          </tr>
        ` : ''}
        <tr class="grand-total">
          <td>Total Invoice Amount:</td>
          <td class="amount">${totalFmt}</td>
        </tr>
        ${isPaid ? `
          <tr>
            <td style="color: #15803d; font-weight: 600;">Amount Paid in Full:</td>
            <td class="amount" style="color: #15803d; font-weight: 700;">${paidFmt}</td>
          </tr>
          <tr>
            <td>Balance Due:</td>
            <td class="amount">${balanceFmt}</td>
          </tr>
        ` : ''}
      </table>
    </div>

    ${isPaid ? `
      <div class="receipt-box">
        <div class="receipt-title">&#10003; Official Payment Receipt Confirmation</div>
        <div class="receipt-grid">
          <div class="receipt-item">
            <label>Payment Received On</label>
            <span>${formatDate(inv.paid_date)}</span>
          </div>
          <div class="receipt-item">
            <label>Payment Method</label>
            <span>${inv.payment_method}</span>
          </div>
          <div class="receipt-item">
            <label>UTR / Transaction Ref</label>
            <span>${inv.transaction_ref || 'UTR' + Math.floor(10000000 + Math.random() * 90000000)}</span>
          </div>
        </div>
      </div>
    ` : `
      <div class="bank-box">
        <div class="bank-box-title">Remittance & Bank Transfer Details</div>
        <div>Account Name: <strong>${inv.company.bank_details?.account_name || 'NexInt AI Technologies Pvt Ltd'}</strong></div>
        <div>Bank: <strong>${inv.company.bank_details?.bank_name || 'HDFC Bank Ltd'}</strong> &bull; A/C No: <strong>${inv.company.bank_details?.account_number || '50200084729103'}</strong></div>
        <div>IFSC Code: <strong>${inv.company.bank_details?.ifsc || 'HDFC0001234'}</strong> &bull; Branch: ${inv.company.bank_details?.branch || 'OMR Cyber City, Chennai'}</div>
        ${inv.company.bank_details?.upi_id ? `<div>UPI ID: <strong>${inv.company.bank_details.upi_id}</strong></div>` : ''}
      </div>
    `}

    <div class="footer">
      <div>
        This is an official computer-generated document issued by NexInt AI Technologies Pvt. Ltd.<br>
        For inquiries, contact billing@nexint.ai or +91 (044) 4801-9200.
      </div>
      <div class="signatory">
        <div class="signatory-line"></div>
        <strong>Authorized Signatory</strong><br>
        NexInt AI Technologies
      </div>
    </div>
  </div>
</body>
</html>`;
}

interface PaymentFormState {
  client_id: string;
  project_id: string;
  phase_name: string;
  phase_number: number;
  amount: string;
  currency: string;
  percentage: string;
  status: PaymentStatus;
  due_date: string;
  paid_date: string;
  paid_amount: string;
  invoice_number: string;
  payment_method: PaymentMethod;
  transaction_ref: string;
  notes: string;
}

const emptyPaymentForm: PaymentFormState = {
  client_id: '',
  project_id: '',
  phase_name: '',
  phase_number: 1,
  amount: '',
  currency: 'INR',
  percentage: '25',
  status: 'Pending',
  due_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
  paid_date: '',
  paid_amount: '',
  invoice_number: '',
  payment_method: 'Bank Transfer / NEFT',
  transaction_ref: '',
  notes: '',
};

export const ClientPaymentsPage: React.FC<ClientPaymentsPageProps> = ({
  initialProjectId,
  onClearInitialId,
  onNavigate,
}) => {
  const { showToast } = useToast();

  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectPaymentGroup[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    total_contract_value: 0,
    total_collected: 0,
    total_pending: 0,
    total_overdue: 0,
    collection_rate: 0,
    total_phases: 0,
    paid_phases: 0,
    pending_phases: 0,
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [viewMode, setViewMode] = useState<'project_phases' | 'all_table'>('project_phases');
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState(initialProjectId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ClientPayment | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyPaymentForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick "Mark as Paid" Modal
  const [payingPhase, setPayingPhase] = useState<ClientPayment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toInputDate(new Date().toISOString()));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer / NEFT');
  const [payUtr, setPayUtr] = useState('');
  const [payInvoice, setPayInvoice] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  // Auto-Generate Phases Modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateProjectId, setGenerateProjectId] = useState('');
  const [generateTemplate, setGenerateTemplate] = useState<'4_phases' | '3_phases' | '5_phases'>('4_phases');
  const [markAdvanceAsPaid, setMarkAdvanceAsPaid] = useState(false);
  const [submittingGenerate, setSubmittingGenerate] = useState(false);

  // Delete Dialog
  const [deletingPayment, setDeletingPayment] = useState<ClientPayment | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Tax Invoice & Receipt Modal
  const [viewingInvoice, setViewingInvoice] = useState<PaymentInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Fetch Payments & Groups
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientFilter !== 'ALL') params.set('client_id', clientFilter);
      if (projectFilter !== 'ALL') params.set('project_id', projectFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiFetch<{
        payments: ClientPayment[];
        project_groups: ProjectPaymentGroup[];
        summary: PaymentsSummary;
      }>(`/payments?${params.toString()}`);

      setPayments(res.payments);
      setProjectGroups(res.project_groups);
      setSummary(res.summary);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch reference clients and projects for selectors
  useEffect(() => {
    Promise.all([
      apiFetch<{ clients: Client[] }>('/clients').catch(() => ({ clients: [] })),
      apiFetch<{ projects: Project[] }>('/projects').catch(() => ({ projects: [] })),
    ]).then(([clientsRes, projectsRes]) => {
      setClients(clientsRes.clients || []);
      setProjects(projectsRes.projects || []);
    });
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [clientFilter, projectFilter, statusFilter, search]);

  useEffect(() => {
    if (initialProjectId) {
      setProjectFilter(initialProjectId);
      onClearInitialId?.();
    }
  }, [initialProjectId]);

  // Projects available for selected client in the Add/Edit form
  const availableProjectsForForm = useMemo(() => {
    if (!form.client_id) return projects;
    return projects.filter((p) => p.client_id === form.client_id);
  }, [projects, form.client_id]);

  // Open Add Modal
  const openCreateModal = (preselectedProjectId?: string) => {
    setEditingPayment(null);
    let targetClientId = '';
    let targetProjectId = preselectedProjectId || '';

    if (targetProjectId) {
      const proj = projects.find((p) => p.id === targetProjectId);
      if (proj) {
        targetClientId = proj.client_id;
      }
    } else if (clientFilter !== 'ALL') {
      targetClientId = clientFilter;
    }

    setForm({
      ...emptyPaymentForm,
      client_id: targetClientId,
      project_id: targetProjectId,
      due_date: toInputDate(new Date(Date.now() + 30 * 86400000).toISOString()),
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (payment: ClientPayment) => {
    setEditingPayment(payment);
    setForm({
      client_id: payment.client_id,
      project_id: payment.project_id,
      phase_name: payment.phase_name,
      phase_number: payment.phase_number || 1,
      amount: String(payment.amount),
      currency: payment.currency || 'INR',
      percentage: String(payment.percentage || 0),
      status: payment.status,
      due_date: toInputDate(payment.due_date),
      paid_date: payment.paid_date ? toInputDate(payment.paid_date) : '',
      paid_amount: String(payment.paid_amount || payment.amount || 0),
      invoice_number: payment.invoice_number || '',
      payment_method: payment.payment_method || 'Bank Transfer / NEFT',
      transaction_ref: payment.transaction_ref || '',
      notes: payment.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Save Add/Edit Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.client_id) {
      setFormError('Please select a Client.');
      return;
    }
    if (!form.project_id) {
      setFormError('Please select a Project.');
      return;
    }
    if (!form.phase_name.trim()) {
      setFormError('Phase / Milestone name is required.');
      return;
    }

    const amountNum = Number(form.amount);
    if (Number.isNaN(amountNum) || amountNum < 0) {
      setFormError('Phase payment amount must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        client_id: form.client_id,
        project_id: form.project_id,
        phase_name: form.phase_name.trim(),
        phase_number: Number(form.phase_number) || 1,
        amount: amountNum,
        currency: form.currency,
        percentage: Number(form.percentage) || 0,
        status: form.status,
        due_date: form.due_date,
        paid_date: form.paid_date || null,
        paid_amount: form.status === 'Paid' ? (Number(form.paid_amount) || amountNum) : Number(form.paid_amount || 0),
        invoice_number: form.invoice_number.trim(),
        payment_method: form.payment_method,
        transaction_ref: form.transaction_ref.trim(),
        notes: form.notes.trim(),
      };

      if (editingPayment) {
        await apiFetch(`/payments/${editingPayment.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast(`Updated phase "${payload.phase_name}"`);
      } else {
        await apiFetch('/payments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`Recorded payment phase "${payload.phase_name}"`);
      }

      setModalOpen(false);
      fetchPayments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save payment phase');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Mark as Paid Modal
  const openPayModal = (payment: ClientPayment) => {
    setPayingPhase(payment);
    setPayAmount(String(payment.amount));
    setPayDate(toInputDate(new Date().toISOString()));
    setPayMethod(payment.payment_method || 'Bank Transfer / NEFT');
    setPayUtr(payment.transaction_ref || '');
    setPayInvoice(payment.invoice_number || '');
  };

  const handleOpenInvoice = async (paymentId: string) => {
    setInvoiceLoading(true);
    try {
      const res = await apiFetch<{ invoice: PaymentInvoice }>(`/payments/${paymentId}/invoice`);
      setViewingInvoice(res.invoice);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate invoice', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!viewingInvoice) return;
    const printWindow = window.open('', '_blank', 'width=880,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    const html = generatePrintableInvoiceHtml(viewingInvoice);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadInvoiceHtml = () => {
    if (!viewingInvoice) return;
    const html = generatePrintableInvoiceHtml(viewingInvoice);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${viewingInvoice.invoice_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded Invoice #${viewingInvoice.invoice_number}`);
  };

  const handleCopyInvoiceSummary = () => {
    if (!viewingInvoice) return;
    const inv = viewingInvoice;
    const summary = `TAX INVOICE & RECEIPT #${inv.invoice_number}
Client: ${inv.client.company}
Project: ${inv.project.name}
Phase: ${inv.phase.phase_name} (${inv.phase.percentage}%)
Milestone Amount: ${formatCurrency(inv.subtotal, inv.phase.currency)}
GST (18%): ${formatCurrency(inv.tax_amount, inv.phase.currency)}
Total Invoice: ${formatCurrency(inv.total_amount, inv.phase.currency)}
Status: ${inv.status.toUpperCase()}
Paid Amount: ${formatCurrency(inv.paid_amount, inv.phase.currency)}
Payment Mode: ${inv.payment_method}
Reference/UTR: ${inv.transaction_ref || 'N/A'}
Date: ${formatDate(inv.paid_date || inv.issue_date)}`;

    navigator.clipboard.writeText(summary);
    showToast('Invoice summary copied to clipboard!');
  };

  const handleConfirmPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingPhase) return;
    const targetId = payingPhase.id;
    setSubmittingPay(true);
    try {
      const res = await apiFetch<{ payment: ClientPayment }>(`/payments/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Paid',
          paid_date: payDate,
          paid_amount: Number(payAmount) || payingPhase.amount,
          payment_method: payMethod,
          transaction_ref: payUtr.trim(),
          invoice_number: payInvoice.trim(),
        }),
      });
      showToast(`Payment recorded! Invoice #${res.payment.invoice_number} generated.`);
      setPayingPhase(null);
      await fetchPayments();
      // Immediately open the generated invoice for user review and print/download
      handleOpenInvoice(targetId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to mark as paid', 'error');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Auto Generate Phases Wizard
  const handleAutoGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateProjectId) {
      showToast('Please select a project to generate phases for', 'error');
      return;
    }
    setSubmittingGenerate(true);
    try {
      const res = await apiFetch<{ message: string }>('/payments/generate-phases', {
        method: 'POST',
        body: JSON.stringify({
          project_id: generateProjectId,
          template: generateTemplate,
          mark_advance_as_paid: markAdvanceAsPaid,
        }),
      });
      showToast(res.message);
      setGenerateModalOpen(false);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate phases', 'error');
    } finally {
      setSubmittingGenerate(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeletingLoading(true);
    try {
      await apiFetch(`/payments/${deletingPayment.id}`, { method: 'DELETE' });
      showToast(`Deleted payment phase "${deletingPayment.phase_name}"`);
      setDeletingPayment(null);
      fetchPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete payment phase', 'error');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const rows = payments.map((p) => ({
      Client: p.client?.company || '',
      Project: p.project?.name || '',
      Phase_Number: p.phase_number,
      Phase_Name: p.phase_name,
      Percentage: `${p.percentage}%`,
      Amount: p.amount,
      Currency: p.currency,
      Status: p.status,
      Due_Date: formatDate(p.due_date),
      Paid_Date: formatDate(p.paid_date),
      Paid_Amount: p.paid_amount,
      Invoice_Number: p.invoice_number || '',
      Payment_Method: p.payment_method || '',
      Transaction_Ref: p.transaction_ref || '',
      Notes: p.notes || '',
    }));
    exportToCsv(`client_payments_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Client Payment Phases &amp; Milestone Billing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track payments of clients in structured milestone phases in respect to each project.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setGenerateProjectId(projects[0]?.id || '');
              setMarkAdvanceAsPaid(false);
              setGenerateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Auto-Generate Phases
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Payment Phase
          </button>
        </div>
      </div>

      {/* 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Contract Value
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(summary.total_contract_value)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Across {summary.total_phases} milestone phases
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span>Total Collected</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(summary.total_collected)}
          </div>
          <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400 mt-0.5">
            {summary.paid_phases} phases cleared
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <span>Pending / Invoiced</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {formatCurrency(summary.total_pending)}
          </div>
          <div className="text-[11px] text-blue-600/90 dark:text-blue-400 mt-0.5">
            {summary.pending_phases} phases scheduled
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <span>Overdue Collections</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {formatCurrency(summary.total_overdue)}
          </div>
          <div className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-0.5">
            Requires follow-up action
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Collection Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
            {summary.collection_rate}%
          </div>
          <div className="text-[11px] text-indigo-600/90 dark:text-indigo-400 mt-0.5">
            Of scheduled project budgets
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Mode Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phase, client, project, invoice or UTR..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setProjectFilter('ALL');
            }}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company}
              </option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Projects</option>
            {(clientFilter === 'ALL'
              ? projects
              : projects.filter((p) => p.client_id === clientFilter)
            ).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Statuses</option>
            {PAYMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* View Switcher: Project Phase Breakdown vs Table */}
        <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('project_phases')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              viewMode === 'project_phases'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Phases by Project
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              viewMode === 'all_table'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            All Payments Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-500 animate-pulse">
          Loading client payment phases...
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <EmptyState
            icon={CreditCard}
            title="No Client Payments Recorded Yet"
            description="Track client milestone payments by adding custom phases or automatically generating 3 to 5 milestone phases based on project budgets."
            actionLabel="Add Payment Phase"
            onAction={() => openCreateModal()}
          />
        </div>
      ) : viewMode === 'project_phases' ? (
        /* Phases by Project View */
        <div className="space-y-6">
          {projectGroups.map((group) => {
            return (
              <div
                key={group.project_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* Project Header Banner */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        <FolderKanban className="w-4 h-4" />
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {group.project_name}
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {group.project_status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <strong>{group.client_name}</strong>
                      </span>
                      <span>&bull;</span>
                      <span>{group.service_type}</span>
                    </div>
                  </div>

                  {/* Financials & Add Phase Button */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Collected: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(group.total_collected, group.currency)}</strong> / {formatCurrency(group.project_budget || group.total_phases_amount, group.currency)}
                      </div>
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        {group.collection_progress_pct}% Total Recovered
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCreateModal(group.project_id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Phase
                    </button>
                  </div>
                </div>

                {/* Progress Bar of Milestone Phases */}
                <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/20">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
                    <span>Phase Payment Journey</span>
                    <span>{group.phases.filter((p) => p.status === 'Paid').length} of {group.phases.length} Phases Paid</span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {group.phases.map((phase) => {
                      const pct = phase.percentage > 0 ? phase.percentage : (100 / group.phases.length);
                      const bg =
                        phase.status === 'Paid'
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : phase.status === 'Invoiced'
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : phase.status === 'Partially Paid'
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : phase.is_overdue || phase.status === 'Overdue'
                          ? 'bg-rose-500 hover:bg-rose-600'
                          : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400';
                      return (
                        <div
                          key={phase.id}
                          style={{ width: `${pct}%` }}
                          title={`${phase.phase_name}: ${formatCurrency(phase.amount, phase.currency)} (${phase.status})`}
                          className={`${bg} h-full border-r border-white dark:border-slate-900 transition-all cursor-pointer`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Grid of Phases for this Project */}
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {group.phases.map((phase) => {
                      const isPaid = phase.status === 'Paid';
                      const isOverdue = phase.is_overdue || phase.status === 'Overdue';

                      return (
                        <div
                          key={phase.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                            isPaid
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/60'
                              : isOverdue
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                              : phase.status === 'Invoiced'
                              ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Phase {phase.phase_number} &bull; {phase.percentage}%
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getPaymentStatusBadge(
                                  phase.status
                                )}`}
                              >
                                {phase.status}
                              </span>
                            </div>

                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                              {phase.phase_name}
                            </h4>

                            <div className="mt-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                              {formatCurrency(phase.amount, phase.currency)}
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Due Date:</span>
                                <span className={isOverdue ? 'text-rose-600 font-bold' : 'font-medium'}>
                                  {formatDate(phase.due_date)}
                                </span>
                              </div>

                              {isPaid && (
                                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <span>Paid On:</span>
                                  <span>{formatDate(phase.paid_date)}</span>
                                </div>
                              )}

                              {phase.invoice_number && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">Invoice:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInvoice(phase.id)}
                                    className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    title="View invoice"
                                  >
                                    <FileText className="w-3 h-3" />
                                    {phase.invoice_number}
                                  </button>
                                </div>
                              )}

                              {phase.transaction_ref && (
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">UTR / Ref:</span>
                                  <span className="font-mono truncate max-w-[120px]" title={phase.transaction_ref}>
                                    {phase.transaction_ref}
                                  </span>
                                </div>
                              )}

                              {phase.notes && (
                                <p className="text-[11px] text-slate-500 italic pt-1 truncate" title={phase.notes}>
                                  &ldquo;{phase.notes}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Phase Action Buttons */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                            {!isPaid ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <button
                                  type="button"
                                  onClick={() => openPayModal(phase)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Mark as Paid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenInvoice(phase.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                  title="View / Generate Tax Invoice"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Invoice
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenInvoice(phase.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                                  title="View & Print Official Tax Invoice / Payment Receipt"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View Invoice
                                </button>
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(phase)}
                                title="Edit Phase"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingPayment(phase)}
                                title="Delete Phase"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* All Payments Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Client &amp; Project</th>
                  <th className="py-3.5 px-4">Phase / Milestone</th>
                  <th className="py-3.5 px-4">Amount &amp; %</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Paid Date</th>
                  <th className="py-3.5 px-4">Invoice &amp; Reference</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                {payments.map((p) => {
                  const isPaid = p.status === 'Paid';
                  const isOverdue = p.is_overdue || p.status === 'Overdue';
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {p.client?.company}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <FolderKanban className="w-3 h-3 text-slate-400" />
                          <span>{p.project?.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                          {p.phase_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Phase {p.phase_number}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {formatCurrency(p.amount, p.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.percentage}% of project
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${getPaymentStatusBadge(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {formatDate(p.due_date)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {isPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {formatDate(p.paid_date)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {p.invoice_number ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(p.id)}
                            className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            title="View & Print Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {p.invoice_number}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(p.id)}
                            className="text-[11px] text-slate-400 hover:text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            title="Generate Invoice"
                          >
                            <FileText className="w-3 h-3" />
                            Generate
                          </button>
                        )}
                        {p.transaction_ref && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ref: {p.transaction_ref}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(p.id)}
                            title="View / Print Tax Invoice"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Invoice
                          </button>
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => openPayModal(p)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                            >
                              Receive
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Phase"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPayment(p)}
                            title="Delete Phase"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Payment Phase Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPayment ? 'Edit Client Payment Phase' : 'Add Client Payment Phase'}
        subtitle="Schedule or record a milestone payment phase for a project"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client *
              </label>
              <select
                value={form.client_id}
                onChange={(e) => {
                  const newClientId = e.target.value;
                  const matchingProj = projects.find((p) => p.client_id === newClientId);
                  setForm({
                    ...form,
                    client_id: newClientId,
                    project_id: matchingProj?.id || '',
                  });
                }}
                disabled={Boolean(editingPayment)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">Select a Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project *
              </label>
              <select
                value={form.project_id}
                onChange={(e) => {
                  const newProjId = e.target.value;
                  const proj = projects.find((p) => p.id === newProjId);
                  setForm({
                    ...form,
                    project_id: newProjId,
                    currency: proj?.currency || 'INR',
                  });
                }}
                disabled={Boolean(editingPayment)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              >
                <option value="">Select a Project</option>
                {availableProjectsForForm.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatCurrency(p.budget, p.currency)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase / Milestone Title *
              </label>
              <input
                type="text"
                value={form.phase_name}
                onChange={(e) => setForm({ ...form, phase_name: e.target.value })}
                placeholder="e.g. Phase 1: Advance / Kickoff"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase #
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.phase_number}
                onChange={(e) => setForm({ ...form, phase_number: Number(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phase Amount (₹) *
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="250000"
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Budget Share (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                placeholder="25"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                {PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.status === 'Paid' && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  Received / Paid Date
                </label>
                <input
                  type="date"
                  value={form.paid_date}
                  onChange={(e) => setForm({ ...form, paid_date: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  value={form.transaction_ref}
                  onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
                  placeholder="e.g. UTR87654321"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Number (Optional)
              </label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="e.g. INV-2026-001"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Milestone Notes / Deliverables
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Scope triggers, deliverables checklist..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Saving Phase...' : editingPayment ? 'Confirm & Update Phase' : 'Confirm & Create Phase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Mark as Paid Modal */}
      <Modal
        open={Boolean(payingPhase)}
        onClose={() => setPayingPhase(null)}
        title={`Receive Payment: ${payingPhase?.phase_name}`}
        subtitle={`Client: ${payingPhase?.client?.company} • Project: ${payingPhase?.project?.name}`}
        maxWidth="max-w-md"
      >
        {payingPhase && (
          <form onSubmit={handleConfirmPaid} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Scheduled Amount:</span>
              <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(payingPhase.amount, payingPhase.currency)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount Received (₹) *
              </label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received Date *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Reference / UTR
                </label>
                <input
                  type="text"
                  value={payUtr}
                  onChange={(e) => setPayUtr(e.target.value)}
                  placeholder="e.g. UTR12345678"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={payInvoice}
                  onChange={(e) => setPayInvoice(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPayingPhase(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPay}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                {submittingPay ? 'Recording...' : 'Confirm Receipt'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Auto-Generate Milestone Phases Wizard Modal */}
      <Modal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Auto-Generate Project Milestone Phases"
        subtitle="Automatically divide project budget into structured billing milestone phases"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAutoGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Project *
            </label>
            <select
              value={generateProjectId}
              onChange={(e) => setGenerateProjectId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.budget, p.currency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Milestone Breakdown Template *
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '4_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '4_phases'}
                  onChange={() => setGenerateTemplate('4_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    4-Phase Standard (25% / 25% / 25% / 25%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Kickoff (25%) &rarr; Prototype (25%) &rarr; UAT (25%) &rarr; Production Go-Live (25%)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '3_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '3_phases'}
                  onChange={() => setGenerateTemplate('3_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    3-Phase Milestone (40% / 40% / 20%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Advance (40%) &rarr; Core Build (40%) &rarr; Delivery Sign-off (20%)
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  generateTemplate === '5_phases'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="template"
                  checked={generateTemplate === '5_phases'}
                  onChange={() => setGenerateTemplate('5_phases')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    5-Phase Enterprise (20% / 20% / 30% / 20% / 10%)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Initiation (20%) &rarr; Arch (20%) &rarr; Build (30%) &rarr; UAT (20%) &rarr; Handover (10%)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* User Consent Toggle for Initial Phase */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markAdvanceAsPaid}
                onChange={(e) => setMarkAdvanceAsPaid(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Mark Phase 1 (Advance) as already paid
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Keep unchecked (default) so all phases remain &quot;Pending&quot; until you explicitly confirm receiving payment.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingGenerate}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {submittingGenerate ? 'Generating...' : 'Confirm & Generate Phases'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        loading={deletingLoading}
        title="Delete Payment Phase"
        description={`Are you sure you want to delete "${deletingPayment?.phase_name}" (${formatCurrency(deletingPayment?.amount, deletingPayment?.currency)})? This will remove this phase from project billing.`}
        confirmLabel="Delete Phase"
      />

      {/* Tax Invoice & Payment Receipt Modal */}
      <Modal
        open={Boolean(viewingInvoice)}
        onClose={() => setViewingInvoice(null)}
        title={viewingInvoice ? `Tax Invoice #${viewingInvoice.invoice_number}` : 'Invoice'}
        subtitle={viewingInvoice ? `${viewingInvoice.client.company} • ${viewingInvoice.project.name}` : ''}
        maxWidth="max-w-4xl"
      >
        {viewingInvoice && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                    viewingInvoice.status === 'Paid'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : viewingInvoice.status === 'Invoiced'
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300'
                  }`}
                >
                  {viewingInvoice.status === 'Paid' ? '✓ PAID IN FULL' : viewingInvoice.status.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Total: <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(viewingInvoice.total_amount, viewingInvoice.phase.currency)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyInvoiceSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Text
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoiceHtml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download HTML
                </button>
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
              </div>
            </div>

            {/* Invoice Sheet Preview */}
            <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-indigo-900 pb-6">
                <div>
                  <h3 className="text-2xl font-extrabold text-indigo-950 tracking-tight">
                    {viewingInvoice.company.name}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                    {viewingInvoice.company.tagline}
                  </p>
                  <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                    <div>{viewingInvoice.company.address}</div>
                    <div>
                      GSTIN: <strong>{viewingInvoice.company.gstin}</strong> &bull; PAN: <strong>{viewingInvoice.company.pan}</strong>
                    </div>
                    <div>
                      Email: {viewingInvoice.company.email} &bull; Web: {viewingInvoice.company.website}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="text-lg font-black uppercase text-indigo-950 tracking-wider">
                    Tax Invoice
                  </div>
                  <div className="font-mono text-sm font-bold text-teal-600">
                    {viewingInvoice.invoice_number}
                  </div>
                  <div className="text-xs text-slate-500 pt-1">
                    <div>Invoice Date: <strong>{formatDate(viewingInvoice.issue_date)}</strong></div>
                    <div>Due Date: <strong>{formatDate(viewingInvoice.due_date)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Bill To & Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                    Billed To (Client)
                  </div>
                  <div className="text-sm font-bold text-slate-900 pt-1">
                    {viewingInvoice.client.company}
                  </div>
                  {viewingInvoice.client.contact_name && (
                    <div className="text-xs font-semibold text-slate-700">
                      Attn: {viewingInvoice.client.contact_name}
                    </div>
                  )}
                  {viewingInvoice.client.address && (
                    <div className="text-xs text-slate-600">{viewingInvoice.client.address}</div>
                  )}
                  <div className="text-xs text-slate-500 pt-1">
                    {viewingInvoice.client.email} {viewingInvoice.client.phone && `• ${viewingInvoice.client.phone}`}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                    Project Engagement Details
                  </div>
                  <div className="text-sm font-bold text-slate-900 pt-1">
                    {viewingInvoice.project.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    Service: <strong>{viewingInvoice.project.service_type || 'Custom Software & AI'}</strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    Milestone: <strong>Phase {viewingInvoice.phase.phase_number} ({viewingInvoice.phase.percentage}%)</strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    Project Budget: <strong>{formatCurrency(viewingInvoice.project.budget || viewingInvoice.subtotal, viewingInvoice.phase.currency)}</strong>
                  </div>
                </div>
              </div>

              {/* Milestone Breakdown Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-indigo-950 text-white font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Milestone Scope &amp; Deliverables</th>
                      <th className="py-2.5 px-4 text-right">Share (%)</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {viewingInvoice.phase.phase_name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {viewingInvoice.notes || 'Milestone sign-off & deliverables completed as per project agreement.'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">
                        {viewingInvoice.phase.percentage}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                        {formatCurrency(viewingInvoice.subtotal, viewingInvoice.phase.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Milestone Subtotal:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(viewingInvoice.subtotal, viewingInvoice.phase.currency)}</span>
                  </div>
                  {viewingInvoice.tax_rate > 0 && (
                    <>
                      <div className="flex justify-between py-1 text-slate-600">
                        <span>CGST ({viewingInvoice.cgst_rate || 9}%):</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(viewingInvoice.cgst_amount || Math.round(viewingInvoice.tax_amount / 2), viewingInvoice.phase.currency)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-600">
                        <span>SGST ({viewingInvoice.sgst_rate || 9}%):</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(viewingInvoice.sgst_amount || Math.round(viewingInvoice.tax_amount / 2), viewingInvoice.phase.currency)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-2 border-t-2 border-b-2 border-indigo-950 font-black text-sm text-indigo-950">
                    <span>Total Invoice Amount:</span>
                    <span>{formatCurrency(viewingInvoice.total_amount, viewingInvoice.phase.currency)}</span>
                  </div>
                  {viewingInvoice.status === 'Paid' && (
                    <div className="flex justify-between py-1 text-emerald-700 font-bold">
                      <span>Amount Received in Full:</span>
                      <span>{formatCurrency(viewingInvoice.paid_amount, viewingInvoice.phase.currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Official Receipt Confirmation or Bank Details */}
              {viewingInvoice.status === 'Paid' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Payment Settlement Receipt Confirmation
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 block">Date Paid</span>
                      <strong className="text-emerald-950">{formatDate(viewingInvoice.paid_date)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Payment Method</span>
                      <strong className="text-emerald-950">{viewingInvoice.payment_method}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">UTR / Ref #</span>
                      <strong className="font-mono text-emerald-950">{viewingInvoice.transaction_ref || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                    Remittance Bank Details
                  </div>
                  <div>Account: <strong>{viewingInvoice.company.bank_details?.account_name}</strong></div>
                  <div>Bank: <strong>{viewingInvoice.company.bank_details?.bank_name}</strong> &bull; A/C: <strong>{viewingInvoice.company.bank_details?.account_number}</strong> &bull; IFSC: <strong>{viewingInvoice.company.bank_details?.ifsc}</strong></div>
                  {viewingInvoice.company.bank_details?.upi_id && (
                    <div>UPI ID: <strong>{viewingInvoice.company.bank_details.upi_id}</strong></div>
                  )}
                </div>
              )}

              {/* Signatory & Disclaimer */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs text-slate-500">
                <div>
                  This is a computer-generated tax invoice issued by {viewingInvoice.company.name}.
                </div>
                <div className="text-left sm:text-right">
                  <div className="w-44 border-b border-dashed border-slate-400 mb-1"></div>
                  <strong className="text-slate-800">Authorized Signatory</strong>
                  <div>NexInt AI Technologies Pvt. Ltd.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

