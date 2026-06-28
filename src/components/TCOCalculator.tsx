import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Users, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  price?: number | string;
  period?: string;
  features?: string[];
}

interface TCOProduct {
  name: string;
  logo_url?: string | null;
  starting_price?: number | null;
  pricing_model?: string | null;
  pricing_tiers?: any;
}

interface TCOCalculatorProps {
  products: TCOProduct[];
}

export function TCOCalculator({ products }: TCOCalculatorProps) {
  const [users, setUsers] = useState(10);
  const [months, setMonths] = useState(12);
  const [setupCost, setSetupCost] = useState(0);
  const [trainingHours, setTrainingHours] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(50);
  const [selectedTiers, setSelectedTiers] = useState<Record<number, number>>({});

  const results = useMemo(() => {
    return products.map((product, idx) => {
      const tiers = Array.isArray(product.pricing_tiers) ? product.pricing_tiers : [];
      const tierIdx = selectedTiers[idx] ?? 0;
      const tier = tiers[tierIdx];
      const monthlyPerUser = tier && typeof tier.price === "number"
        ? tier.price
        : product.starting_price ?? 0;

      const licenseCost = monthlyPerUser * users * months;
      const trainingCost = trainingHours * hourlyRate;
      const total = licenseCost + setupCost + trainingCost;

      return {
        name: product.name,
        logo_url: product.logo_url,
        tierName: tier?.name || product.pricing_model || "Default",
        monthlyPerUser,
        licenseCost,
        setupCost,
        trainingCost,
        total,
      };
    });
  }, [products, users, months, setupCost, trainingHours, hourlyRate, selectedTiers]);

  const minTotal = Math.min(...results.map((r) => r.total));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-display font-bold text-foreground">Total Cost of Ownership Calculator</h2>
      </div>

      {/* Inputs */}
      <div className="glass-card p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Number of Users</Label>
            <Input type="number" min={1} max={10000} value={users} onChange={(e) => setUsers(Math.max(1, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Duration (months)</Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">1 year</SelectItem>
                <SelectItem value="24">2 years</SelectItem>
                <SelectItem value="36">3 years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> One-time Setup Cost ($)</Label>
            <Input type="number" min={0} value={setupCost} onChange={(e) => setSetupCost(Math.max(0, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Training Hours × ${hourlyRate}/hr</Label>
            <div className="flex gap-2">
              <Input type="number" min={0} value={trainingHours} onChange={(e) => setTrainingHours(Math.max(0, Number(e.target.value)))} className="flex-1" />
              <Input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))} className="w-20" placeholder="$/hr" />
            </div>
          </div>
        </div>
      </div>

      {/* Tier selection per product */}
      {products.some((p) => Array.isArray(p.pricing_tiers) && p.pricing_tiers.length > 1) && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-3 text-foreground">Select Plan per Product</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map((product, idx) => {
              const tiers = Array.isArray(product.pricing_tiers) ? product.pricing_tiers : [];
              if (tiers.length <= 1) return null;
              return (
                <div key={idx} className="space-y-1.5">
                  <Label className="text-xs">{product.name}</Label>
                  <Select value={String(selectedTiers[idx] ?? 0)} onValueChange={(v) => setSelectedTiers((s) => ({ ...s, [idx]: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiers.map((t, ti) => (
                        <SelectItem key={ti} value={String(ti)}>
                          {t.name} {typeof t.price === "number" ? `($${t.price}/mo)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      <div className={cn("grid gap-4", results.length === 1 ? "max-w-md" : results.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
        {results.map((r, i) => (
          <div
            key={i}
            className={cn(
              "glass-card p-6 relative overflow-hidden transition-all",
              r.total === minTotal && results.length > 1 && "ring-2 ring-primary shadow-lg shadow-primary/10"
            )}
          >
            {r.total === minTotal && results.length > 1 && (
              <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-bold">Best Value</Badge>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                {r.logo_url ? <img decoding="async" loading="lazy" src={r.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">{r.name.charAt(0)}</span>}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">{r.name}</h3>
                <span className="text-xs text-muted-foreground">{r.tierName} plan</span>
              </div>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">License cost</span>
                <span className="font-medium text-foreground">${r.licenseCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup cost</span>
                <span className="font-medium text-foreground">${r.setupCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Training cost</span>
                <span className="font-medium text-foreground">${r.trainingCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-semibold text-foreground">Total ({months} months)</span>
                <span className="font-display font-bold text-lg text-foreground">${r.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              ~${Math.round(r.total / months).toLocaleString()}/mo · ~${r.monthlyPerUser}/user/mo
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
