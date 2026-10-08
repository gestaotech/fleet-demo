"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function RelEstoquePage() {
  useRoleGuard(["GESTOR"]);
  const totalItems = db.parts.length;
  const lowStock = db.parts.filter(p=>p.stock<=p.minStock).length;
  const entradas = db.stockMovements.filter(m=>m.type==="Entrada").length;
  const saidas = db.stockMovements.filter(m=>m.type==="Saída").length;

  const partUsage: Record<string, number> = {};
  db.workOrders.forEach(w=> w.items.forEach(i=>{ partUsage[i.partId] = (partUsage[i.partId]||0)+i.quantity; }));
  const topParts = Object.entries(partUsage).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([pid,qty])=> ({part:db.parts.find(p=>p.id===pid), qty}));

  return (
    <DashboardLayout title="Relatório de Estoque" breadcrumbs={[{ label: "Relatórios", href: "/relatorios/estoque" }, { label: "Estoque" }]}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de itens</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalItems}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Estoque baixo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lowStock}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Entradas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{entradas}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saídas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{saidas}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Peças mais utilizadas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Peça</TableHead><TableHead className="text-right">Estoque atual</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Quantidade utilizada</TableHead></TableRow></TableHeader>
              <TableBody>
                {topParts.map(t=> <TableRow key={t.part?.id}><TableCell>{t.part?.name} ({t.part?.code})</TableCell><TableCell className="text-right">{t.part?.stock}</TableCell><TableCell className="text-right">{t.part?.minStock}</TableCell><TableCell className="text-right">{t.qty}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Itens com estoque baixo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Peça</TableHead><TableHead className="text-right">Estoque</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {db.parts.filter(p=>p.stock<=p.minStock).map(p=> <TableRow key={p.id}><TableCell>{p.code}</TableCell><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.stock}</TableCell><TableCell className="text-right">{p.minStock}</TableCell><TableCell><Badge variant={p.stock<=0?"destructive":"warning"}>{p.stock<=0?"Fora de estoque":"Baixo"}</Badge></TableCell></TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}