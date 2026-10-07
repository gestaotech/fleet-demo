"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FrotaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const vehicle = db.vehicles.find(v => v.id === id);
  const orders = db.workOrders.filter(wo => wo.vehicleId === id).sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!vehicle) return <DashboardLayout title="Veículo não encontrado" breadcrumbs={[{ label: "Frota", href: "/frota" }]}><p>Veículo não encontrado</p></DashboardLayout>;

  const statusBadge = (s: string) => {
    switch (s) {
      case "Disponível": return <Badge variant="success">{s}</Badge>;
      case "Em manutenção": return <Badge variant="warning">{s}</Badge>;
      default: return <Badge variant="destructive">{s}</Badge>;
    }
  };
  const orderStatusBadge = (s: string) => {
    switch (s) {
      case "Finalizada": return <Badge variant="success">{s}</Badge>;
      case "Em andamento": return <Badge variant="default">{s}</Badge>;
      case "Aguardando peças": return <Badge variant="warning">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  return (
    <DashboardLayout title={vehicle.name} breadcrumbs={[{ label: "Frota", href: "/frota" }, { label: vehicle.name }]}>
      <div className="space-y-6">
        {/* Info cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>{statusBadge(vehicle.status)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quilometragem</CardTitle>
            </CardHeader>
            <CardContent>{vehicle.km.toLocaleString("pt-BR")} km</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Última manutenção</CardTitle>
            </CardHeader>
            <CardContent>{new Date(vehicle.lastMaintenance).toLocaleDateString("pt-BR")}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Próxima manutenção</CardTitle>
            </CardHeader>
            <CardContent>{new Date(vehicle.nextMaintenance).toLocaleDateString("pt-BR")}</CardContent>
          </Card>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do veículo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><span className="text-muted-foreground">Placa:</span> <span className="ml-2 font-medium">{vehicle.plate}</span></div>
            <div><span className="text-muted-foreground">Modelo:</span> <span className="ml-2">{vehicle.model}</span></div>
            <div><span className="text-muted-foreground">Ano:</span> <span className="ml-2">{vehicle.year}</span></div>
            <div><span className="text-muted-foreground">KM atual:</span> <span className="ml-2">{vehicle.km.toLocaleString("pt-BR")} km</span></div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ordens de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma ordem de serviço registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead>Mecânico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(wo => {
                    const mechanic = db.mechanics.find(m => m.id === wo.mechanicId);
                    return (
                      <TableRow key={wo.id}>
                        <TableCell><Link href={`/manutencao/${wo.id}`} className="text-primary hover:underline">{wo.id}</Link></TableCell>
                        <TableCell className="max-w-xs truncate">{wo.problem}</TableCell>
                        <TableCell>{mechanic?.name}</TableCell>
                        <TableCell>{orderStatusBadge(wo.status)}</TableCell>
                        <TableCell>{new Date(wo.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right"><Link href={`/manutencao/${wo.id}`}><ArrowRight className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Link></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}