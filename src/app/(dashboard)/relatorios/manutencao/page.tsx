"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function RelManutencaoPage() {
  useRoleGuard(["GESTOR"]);
  const total = db.workOrders.length;
  const abertas = db.workOrders.filter(w=>w.status==="Aberta").length;
  const andamento = db.workOrders.filter(w=>w.status==="Em andamento").length;
  const finalizadas = db.workOrders.filter(w=>w.status==="Finalizada").length;

  // vehicle stats
  const vehicleStats = db.vehicles.map(v => {
    const count = db.workOrders.filter(w=>w.vehicleId===v.id).length;
    const partsUsed = db.workOrders.filter(w=>w.vehicleId===v.id).flatMap(w=>w.items).reduce((s,i)=>s+i.quantity,0);
    return { vehicle:v, count, partsUsed };
  }).sort((a,b)=>b.count-a.count);

  // parts most used
  const partUsage: Record<string, number> = {};
  db.workOrders.forEach(w=> w.items.forEach(i=>{ partUsage[i.partId] = (partUsage[i.partId]||0)+i.quantity; }));
  const topParts = Object.entries(partUsage).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([pid,qty])=> ({part:db.parts.find(p=>p.id===pid), qty}));

  return (
    <DashboardLayout title="Relatório de Manutenção" breadcrumbs={[{ label: "Relatórios", href: "/relatorios/manutencao" }, { label: "Manutenção" }]}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de OS</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Abertas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{abertas}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Em andamento</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{andamento}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Finalizadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{finalizadas}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Veículos com mais manutenções</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Placa</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Peças utilizadas</TableHead></TableRow></TableHeader>
              <TableBody>
                {vehicleStats.map(v=> <TableRow key={v.vehicle.id}><TableCell>{v.vehicle.name}</TableCell><TableCell>{v.vehicle.plate}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">{v.partsUsed}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Peças mais utilizadas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Peça</TableHead><TableHead className="text-right">Quantidade utilizada</TableHead></TableRow></TableHeader>
              <TableBody>
                {topParts.map(t=> <TableRow key={t.part?.id}><TableCell>{t.part?.name} ({t.part?.code})</TableCell><TableCell className="text-right">{t.qty}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}