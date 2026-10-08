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
import { db, addWorkOrderItem, updateWorkOrderStatus, addServiceToWorkOrder, finalizeWorkOrder } from "@/lib/mocks";
import { Plus, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function OSDetailPage() {
  useRoleGuard(["GESTOR", "MANUTENCAO"]);
  const params = useParams();
  const id = params.id as string;
  const wo = db.workOrders.find(w => w.id === id);
  const vehicle = wo ? db.vehicles.find(v => v.id === wo.vehicleId) : null;
  const mechanic = wo ? db.mechanics.find(m => m.id === wo.mechanicId) : null;

  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");

  // Service modal
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [newService, setNewService] = useState({ name: "", description: "", status: "Pendente" });

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
    addWorkOrderItem(wo.id, { partId, quantity: qty, status: "Solicitada" });
    if (wo.status === "Aberta") updateWorkOrderStatus(wo.id, "Aguardando peças");
    toast.success("Solicitação enviada ao almoxarifado.");
    setPartId(""); setQty(1); setObs("");
  };

  const handleAddService = () => {
    if (!newService.name.trim()) { toast.error("Informe o nome do serviço"); return; }
    addServiceToWorkOrder(wo.id, newService.name);
    toast.success("Serviço adicionado à Ordem de Serviço.");
    setNewService({ name: "", description: "", status: "Pendente" });
    setIsServiceOpen(false);
  };

  const handleStatusChange = (newStatus: string) => {
    updateWorkOrderStatus(wo.id, newStatus as typeof wo.status);
    toast.success(`Status alterado para ${newStatus}`);
  };

  const handleFinalize = () => {
    // check pending requests
    const pending = db.partRequests.some(r => r.workOrderId === wo.id && r.status === "Pendente");
    if (pending) {
      toast.error("Existem peças aguardando atendimento do almoxarifado.");
      return;
    }
    finalizeWorkOrder(wo.id);
    toast.success("Ordem de Serviço finalizada com sucesso.");
  };

  if (!wo) return <DashboardLayout title="OS não encontrada" breadcrumbs={[{ label: "Manutenção", href: "/manutencao" }]}><p>OS não encontrada</p></DashboardLayout>;

  const statusOptions = ["Aberta", "Em andamento", "Aguardando peças", "Finalizada"];

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
                <Select value={wo.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {wo.status !== "Finalizada" && (
                  <Button variant="secondary" onClick={handleFinalize}><CheckCircle className="mr-2 h-4 w-4" /> Finalizar</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div><span className="text-muted-foreground">Mecânico:</span> <span className="ml-2 font-medium">{mechanic?.name}</span></div>
            <div><span className="text-muted-foreground">Data abertura:</span> <span className="ml-2">{new Date(wo.createdAt).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Última atualização:</span> <span className="ml-2">{new Date(wo.updatedAt).toLocaleDateString("pt-BR")}</span></div>
            {wo.observations && (
              <div className="col-span-3"><span className="text-muted-foreground">Observações:</span> <p className="mt-1">{wo.observations}</p></div>
            )}
          </CardContent>
        </Card>

        {/* Problem */}
        <Card>
          <CardHeader><CardTitle>Problema informado</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap">{wo.problem}</p></CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Serviços</CardTitle>
            <Dialog open={isServiceOpen} onOpenChange={setIsServiceOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Adicionar serviço</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>Adicionar serviço</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Serviço</label>
                    <Input value={newService.name} onChange={e=>setNewService({...newService, name:e.target.value})} placeholder="Nome do serviço" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Descrição (opcional)</label>
                    <Input value={newService.description} onChange={e=>setNewService({...newService, description:e.target.value})} placeholder="Descrição" />
                  </div>
                  <Select value={newService.status} onValueChange={v=>setNewService({...newService, status:v})}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={()=>setIsServiceOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddService}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {wo.services.length === 0 ? (
              <p className="text-muted-foreground">Nenhum serviço registrado.</p>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {wo.services.map((s,i)=> <li key={i}>{s}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Parts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Peças</CardTitle>
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