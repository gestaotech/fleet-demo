"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { Truck, Wrench, ClipboardList, Package, AlertTriangle, PackageCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function GestorPage() {
  useRoleGuard(["GESTOR"]);

  const totalVehicles = db.vehicles.length;
  const vehiclesInMaintenance = db.vehicles.filter(v => v.status === "Em manutenção").length;
  const openOrders = db.workOrders.filter(wo => wo.status !== "Finalizada").length;
  const awaitingParts = db.workOrders.filter(wo => wo.status === "Aguardando peças").length;
  const pendingRequests = db.partRequests.filter(r => r.status === "Pendente").length;
  const lowStockItems = db.parts.filter(p => p.stock <= p.minStock).length;

  const recentOrders = db.workOrders
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const pendingReqs = db.partRequests.filter(r => r.status === "Pendente").slice(0, 5);
  const lowStockParts = db.parts.filter(p => p.stock <= p.minStock).slice(0, 5);

  const statusBadge = (status: string) => {
    switch (status) {
      case "Finalizada": return <Badge variant="success">{status}</Badge>;
      case "Em andamento": return <Badge variant="default">{status}</Badge>;
      case "Aguardando peças": return <Badge variant="warning">{status}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const statCards = [
    { title: "Total de veículos", value: totalVehicles, desc: "Veículos cadastrados", icon: Truck, color: "text-brand-primary", bg: "bg-brand-primary-light" },
    { title: "Em manutenção", value: vehiclesInMaintenance, desc: "Veículos atualmente em manutenção", icon: Wrench, color: "text-warning", bg: "bg-warning/10" },
    { title: "OS abertas", value: openOrders, desc: "Ordens de serviço não finalizadas", icon: ClipboardList, color: "text-brand-primary", bg: "bg-brand-primary-light" },
    { title: "OS aguardando peças", value: awaitingParts, desc: "Ordens aguardando retirada de peças", icon: Package, color: "text-warning", bg: "bg-warning/10" },
    { title: "Solicitações pendentes", value: pendingRequests, desc: "Aguardando atendimento do almoxarifado", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
    { title: "Estoque baixo", value: lowStockItems, desc: "Itens iguais ou abaixo do mínimo", icon: PackageCheck, color: "text-danger", bg: "bg-danger/10" },
  ];

  return (
    <DashboardLayout title="Dashboard do Gestor" breadcrumbs={[{ label: "Gestor", href: "/gestor" }, { label: "Dashboard" }]}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard do Gestor</h1>
          <p className="text-text-secondary mt-1">Visão consolidada da operação.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map((c, idx) => {
            const Icon = c.icon;
            return (
              <Card key={idx} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-secondary">{c.title}</p>
                      <p className="text-3xl font-bold text-text-primary mt-1">{c.value}</p>
                      <p className="text-xs text-text-secondary mt-1">{c.desc}</p>
                    </div>
                    <div className={cn("p-3 rounded-lg shrink-0", c.bg)}>
                      <Icon className={cn("h-5 w-5", c.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-primary" />
                Ordens de serviço recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-4">OS</TableHead>
                    <TableHead className="px-4">Veículo</TableHead>
                    <TableHead className="px-4">Problema</TableHead>
                    <TableHead className="px-4">Mecânico</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((wo) => {
                    const vehicle = db.vehicles.find(v => v.id === wo.vehicleId);
                    const mechanic = db.mechanics.find(m => m.id === wo.mechanicId);
                    return (
                      <TableRow key={wo.id}>
                        <TableCell className="px-4"><Link href={`/manutencao/${wo.id}`} className="text-brand-primary hover:underline font-medium">{wo.id}</Link></TableCell>
                        <TableCell className="px-4">{vehicle?.name} ({vehicle?.plate})</TableCell>
                        <TableCell className="px-4 max-w-xs truncate">{wo.problem}</TableCell>
                        <TableCell className="px-4">{mechanic?.name}</TableCell>
                        <TableCell className="px-4">{statusBadge(wo.status)}</TableCell>
                        <TableCell className="px-4">{new Date(wo.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Solicitações pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-4">Req</TableHead>
                    <TableHead className="px-4">OS</TableHead>
                    <TableHead className="px-4">Veículo</TableHead>
                    <TableHead className="px-4">Solicitante</TableHead>
                    <TableHead className="px-4">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReqs.map((req) => {
                    const wo = db.workOrders.find(w => w.id === req.workOrderId);
                    const vehicle = wo ? db.vehicles.find(v => v.id === wo.vehicleId) : null;
                    const requester = db.mechanics.find(m => m.id === req.requesterId);
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="px-4"><Link href="/almoxarifado/solicitacoes" className="text-brand-primary hover:underline font-mono">{req.id}</Link></TableCell>
                        <TableCell className="px-4">{wo?.id}</TableCell>
                        <TableCell className="px-4">{vehicle?.name} ({vehicle?.plate})</TableCell>
                        <TableCell className="px-4">{requester?.name}</TableCell>
                        <TableCell className="px-4">{new Date(req.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-danger" />
              Estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="px-4">Peça</TableHead>
                  <TableHead className="px-4">Estoque</TableHead>
                  <TableHead className="px-4">Mínimo</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockParts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="px-4">{p.name}</TableCell>
                    <TableCell className="px-4">{p.stock}</TableCell>
                    <TableCell className="px-4">{p.minStock}</TableCell>
                    <TableCell className="px-4"><Badge variant={p.stock <= 0 ? "destructive" : "warning"}>Baixo</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}