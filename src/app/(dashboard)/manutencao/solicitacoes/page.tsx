"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function MinhasSolicitacoesPage() {
  useRoleGuard(["GESTOR", "MANUTENCAO"]);

  const statusBadge = (s: string) => {
    switch (s) {
      case "Pendente": return <Badge variant="warning">{s}</Badge>;
      case "Retirada confirmada": return <Badge variant="success">{s}</Badge>;
      case "Recusada": return <Badge variant="destructive">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  // Show all requests (in real app filter by current user)
  const requests = [...db.partRequests].sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <DashboardLayout title="Minhas solicitações" breadcrumbs={[{ label: "Manutenção", href: "/manutencao" }, { label: "Solicitações" }]}>
      <Card>
        <CardHeader><CardTitle>Solicitações de peças</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma solicitação encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requisição</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Peças</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(req => {
                  const wo = db.workOrders.find(w => w.id === req.workOrderId);
                  const vehicle = wo ? db.vehicles.find(v => v.id === wo.vehicleId) : null;
                  const totalQty = req.items.reduce((sum,i)=> sum + i.quantity,0);
                  const pieces = req.items.map(i=>{ const p=db.parts.find(p=>p.id===i.partId); return `${p?.name} (${i.quantity})` }).join(", ");
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono">{req.id}</TableCell>
                      <TableCell>{wo?.id}</TableCell>
                      <TableCell>{vehicle?.name} ({vehicle?.plate})</TableCell>
                      <TableCell>{pieces}</TableCell>
                      <TableCell className="text-right">{totalQty}</TableCell>
                      <TableCell>{new Date(req.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{statusBadge(req.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}