import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { friendlyErrorMessage } from "@/api/client";
import { getAdminOverview, type AdminOverview } from "@/api/admin";
import { Reveal, Stagger, hoverLift, rowItem, staggerContainer, staggerItem } from "@/components/ui/motion";

/** Finished generations only — in-flight rows are neither a success nor a failure yet. */
function successRate(completed: number, failed: number): string {
  const finished = completed + failed;
  return finished > 0 ? `${Math.round((completed / finished) * 100)}%` : "—";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div variants={staggerItem} {...hoverLift} className="min-w-0">
      <Card className="h-full transition-shadow duration-300 hover:shadow-lift">
        <CardBody>
          <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-1 break-words font-display text-2xl text-stone-900">{value}</p>
        </CardBody>
      </Card>
    </motion.div>
  );
}

/**
 * Admin-only overview. Authorization is enforced entirely server-side
 * (profiles.is_admin, re-checked on every request) — this page never
 * decides who is an admin; it only renders what the server chose to
 * return (or a 403/"not found" state for anyone else).
 */
export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminOverview()
      .then(setOverview)
      .catch((err) => setError(friendlyErrorMessage(err, "We couldn't load the admin overview.")));
  }, []);

  if (error) {
    return (
      <PageContainer className="max-w-5xl">
        <ErrorState message={error} />
      </PageContainer>
    );
  }

  if (overview === undefined) {
    return (
      <PageContainer className="max-w-5xl">
        <Skeleton className="h-9 w-40" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (overview === null) {
    return (
      <PageContainer className="max-w-5xl">
        <p className="animate-fade-up text-stone-500">You don't have access to this page.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-5xl">
      <Reveal immediate>
        <h1 className="font-display text-3xl text-stone-900">Admin</h1>
      </Reveal>

      <Stagger as="section" className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total users" value={overview.users.total} />
        <Stat label="Active (30d)" value={overview.users.active_30d} />
        <Stat label="Credits purchased" value={overview.credits.purchased} />
        <Stat label="Credits consumed" value={overview.credits.consumed} />
      </Stagger>

      <Stagger as="section" delay={0.12} className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Credits reserved (in-flight)" value={overview.credits.reserved} />
        <Stat label="Outstanding balance (all users)" value={overview.credits.outstanding} />
        <Stat label="Generations total" value={overview.generations.total} />
        <Stat label="Generation success rate" value={successRate(overview.generations.completed, overview.generations.failed)} />
      </Stagger>

      <Stagger as="section" delay={0.12} className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Payments (paid)" value={overview.payments.paid_count} />
        <Stat label="Payment volume" value={`₹${(overview.payments.paid_paise / 100).toLocaleString("en-IN")}`} />
        <Stat label="Payments failed" value={overview.payments.failed_count} />
        <Stat label="Refunds" value={overview.payments.refunded_count} />
      </Stagger>

      <Reveal as="section" className="mt-10">
        <h2 className="font-display text-lg text-stone-900">Recent transactions</h2>
        <Card className="scroll-soft mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <motion.tbody variants={staggerContainer(0.035)} initial="hidden" whileInView="show" viewport={{ once: true }}>
              {overview.recent_transactions.map((t) => (
                <motion.tr key={t.id} variants={rowItem} className="border-b border-stone-100/80 transition-colors duration-200 last:border-0 hover:bg-surface-sage/40">
                  <td className="whitespace-nowrap px-4 py-3 text-stone-500">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-stone-500">{t.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-stone-700">{t.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-right text-stone-900">{t.amount}</td>
                  <td className="px-4 py-3 text-stone-500">{t.status}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </Card>
      </Reveal>

      {overview.recent_errors.length > 0 && (
        <Reveal as="section" className="mt-10">
          <h2 className="font-display text-lg text-stone-900">Recent generation errors</h2>
          <Card className="scroll-soft mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {overview.recent_errors.map((e) => (
                  <tr key={e.id} className="border-b border-stone-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{e.user_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-stone-700">{e.error_message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Reveal>
      )}
    </PageContainer>
  );
}
