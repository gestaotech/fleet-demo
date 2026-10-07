"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db, addWorkOrderItem, updateWorkOrderStatus } from "@/lib/mocks";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function OSDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const wo = db.workOrders.find(w => w.id === id);
  const vehicle = wo ? db.vehicles.find(v => v.id === wo.vehicleId) : null;
  const mechanic = wo ? db.mechanics.find(m => m.id === wo.mechanicId) : null;

  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");

  if (!wo) return <DashboardLayout title="OS não encontrada" breadcrumbs={[{ label: "Manutenção", href: "/manutencao" }]}><p>OS não encontrada</p></DashboardLayout>;

  const statusBadge = (s: string) => {
    switch (s) {
      case "Finalizada": return <Badge variant="success">{s}</Badge>;
      case "Em andamento": return <Badge variant="default">{s}</Badge>;
      case "Aguardando peças": return <Badge variant="warning">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const handleRequest = () => {
    if (!partId || qty <= 0) return;
    const reqId = `REQ-${String(db.partRequests.length + 1).padStart(5, "0")}`;
    db.partRequests.push({
      id: reqId,
      workOrderId: wo.id,
      vehicleId: wo.vehicleId,
      requesterId: wo.mechanicId,
      items: [{ partId, quantity: qty }],
      status: "Pendente",
      createdAt: new Date().toISOString(),
    });
    // add to OS items as solicitada
    addWorkOrderItem(wo.id, { partId, quantity: qty, status: "Solicitada" });
    if (wo.status === "Aberta") updateWorkOrderStatus(wo.id, "Aguardando peças");
    toast.success("Solicitação enviada ao almoxarifado.");
    setPartId(""); setQty(1); setObs("");
  };

  return (
    <DashboardLayout title={`OS ${wo.id}`} breadcrumbs={[{ label: "Manutenção", href: "/manutencao" }, { label: wo.id }]}>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{wo.id}</CardTitle>
                <p className="text-muted-foreground">{vehicle?.name} ({vehicle?.plate})</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{statusBadge(wo.status)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div><span className="text-muted-foreground">Mecânico:</span> <span className="ml-2 font-medium">{mechanic?.name}</span></div>
            <div><span className="text-muted-foreground">Data abertura:</span> <span className="ml-2">{new Date(wo.createdAt).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Última atualização:</span> <span className="ml-2">{new Date(wo.updatedAt).toLocaleDateString("pt-BR")}</span></div>
          </CardContent>
        </Card>

        {/* Problem */}
        <Card>
          <CardHeader><CardTitle>Problema informado</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap">{wo.problem}</p></CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader><CardTitle>Serviços</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {wo.services.map((s,i)=> <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>

        {/* Parts used */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Peças utilizadas</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Solicitar peça</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader><DialogTitle>Solicitar peça</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <Select value={partId} onValueChange={setPartId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                    <SelectContent>
                      {db.parts.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name} (Estoque: {p.stock})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Quantidade</label>
                      <Input type="number" min="1" value={qty} onChange={e=>setQty(parseInt(e.target.value)||1)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Observação</label>
                      <Input value={obs} onChange={e=>setObs(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={()=>{setPartId("");setQty(1);setObs("")}}>Cancelar</Button>
                  <Button onClick={handleRequest}>Enviar solicitação</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {wo.items.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma peça registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wo.items.map((item, idx) => {
                    const part = db.parts.find(p => p.id === item.partId);
                    const statusBadge = (st: string) => {
                      switch (st) {
                        case "Utilizada": return <Badge variant="success">{st}</Badge>;
                        case "Retirada": return <Badge variant="default">{st}</Badge>;
                        default: return <Badge variant="warning">{st}</Badge>;
                      }
                    };
                    return (
                      <TableRow key={idx}>
                        <TableCell>{part?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{statusBadge(item.status)}</TableCell>
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