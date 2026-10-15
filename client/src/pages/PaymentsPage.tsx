import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Reveal, rowItem, staggerContainer } from "@/components/ui/motion";
import { friendlyErrorMessage } from "@/api/client";
import { getPayments, type Payment } from "@/api/billing";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  created: "warning",
  failed: "danger",
  refunded: "neutral",
};

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPayments(null);
    getPayments()
      .then((list) => {
        if (!cancelled) setPayments(list);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyErrorMessage(err, "We couldn't load your payment history."));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (error) {
    return (
      <PageContainer className="max-w-5xl">
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-5xl">
      <Reveal immediate>
        <h1 className="font-display text-3xl text-stone-900">Payments</h1>
      </Reveal>
      <Reveal immediate delay={0.08}>
        <p className="mt-2 text-stone-600">Every credit purchase and its status.</p>
      </Reveal>

      <div className="mt-6">
        {payments === null ? (
          <div className="space-y-3 rounded-2xl border border-hairline bg-surface-card p-4 shadow-soft" aria-busy="true" aria-label="Loading payments">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState title="No payments yet" description="Buy credits to see your payment history here." />
        ) : (
          <Card className="scroll-soft animate-fade-up overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Payment ID</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer(0.04, 0.1)} initial="hidden" animate="show">
                {payments.map((p) => (
                  <motion.tr key={p.id} variants={rowItem} className="border-b border-stone-100/80 transition-colors duration-200 last:border-0 hover:bg-surface-sage/40">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-stone-900">
                      {p.packageName} <span className="text-stone-500">({p.credits} credits)</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">₹{(p.amountPaise / 100).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-stone-500">{p.currency}</td>
                    <td className="px-4 py-3 text-stone-500">razorpay</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{p.providerPaymentId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
