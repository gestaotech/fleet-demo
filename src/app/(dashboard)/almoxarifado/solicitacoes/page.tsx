"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db, updateRequestStatus, addStockMovement, updatePartStock, addWorkOrderItem, updateWorkOrderStatus } from "@/lib/mocks";
import { Eye, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function SolicitacoesPage() {
  useRoleGuard(["GESTOR", "ALMOXARIFADO"]);
  const [selectedReq, setSelectedReq] = useState<typeof db.partRequests[0] | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const statusBadge = (s: string) => {
    switch (s) {
      case "Pendente": return <Badge variant="warning">{s}</Badge>;
      case "Separada": return <Badge variant="default">{s}</Badge>;
      case "Retirada confirmada": return <Badge variant="success">{s}</Badge>;
      case "Recusada": return <Badge variant="destructive">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const handleProcess = (req: typeof db.partRequests[0]) => setSelectedReq(req);

  const handleRejectOpen = (req: typeof db.partRequests[0]) => {
    setSelectedReq(req);
    setRejectReason("");
  };

  const handleRejectConfirm = () => {
    if (!selectedReq || !rejectReason.trim()) return;
    updateRequestStatus(selectedReq.id, "Recusada");
    const wo = db.workOrders.find(w => w.id === selectedReq.workOrderId);
    if (wo) {
      wo.observations = (wo.observations || "") + `\n[Recusado almoxarifado: ${rejectReason}]`;
    }
    alert("Solicitação recusada.");
    setSelectedReq(null);
    setRejectReason("");
  };

  const handleConfirm = () => {
    if (!selectedReq) return;
    for (const it of selectedReq.items) {
      const part = db.parts.find(p => p.id === it.partId);
      if (!part || part.stock < it.quantity) {
        alert("Estoque insuficiente para realizar esta retirada.");
        return;
      }
    }
    for (const it of selectedReq.items) {
      updatePartStock(it.partId, -it.quantity);
      addStockMovement({
        id: `mov-${Date.now()}-${Math.random()}`,
        date: new Date().toISOString(),
        type: "Saída",
        partId: it.partId,
        quantity: -it.quantity,
        origin: selectedReq.workOrderId,
        responsible: "Almoxarifado",
      });
      addWorkOrderItem(selectedReq.workOrderId, { partId: it.partId, quantity: it.quantity, status: "Retirada" });
    }
    updateRequestStatus(selectedReq.id, "Retirada confirmada");
    const wo = db.workOrders.find(w => w.id === selectedReq.workOrderId);
    if (wo && wo.status === "Aguardando peças") updateWorkOrderStatus(wo.id, "Em andamento");
    alert("Retirada confirmada com sucesso.");
    setSelectedReq(null);
  };

  return (
    <DashboardLayout title="Solicitações" breadcrumbs={[{ label: "Almoxarifado", href: "/almoxarifado" }, { label: "Solicitações" }]}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Solicitações de peças</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requisição</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {db.partRequests.map(req => {
                  const wo = db.workOrders.find(w => w.id === req.workOrderId);
                  const vehicle = wo ? db.vehicles.find(v => v.id === wo.vehicleId) : null;
                  const requester = db.mechanics.find(m => m.id === req.requesterId);
                  return (
                    <TableRow key={req.id} className={req.status==="Pendente"?"bg-yellow-50":""}>
                      <TableCell className="font-mono">{req.id}</TableCell>
                      <TableCell>{wo?.id}</TableCell>
                      <TableCell>{vehicle?.name} ({vehicle?.plate})</TableCell>
                      <TableCell>{requester?.name}</TableCell>
                      <TableCell>{new Date(req.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{req.items.length}</TableCell>
                      <TableCell>{statusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        {req.status==="Pendente" && (
                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={()=>handleRejectOpen(req)}><XCircle className="mr-1 h-3 w-3" /> Recusar</Button>
                            <Button size="sm" onClick={()=>handleProcess(req)}><Eye className="mr-1 h-3 w-3" /> Processar</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Process/Reject Modals */}
        {selectedReq && (
          <>
            {/* Process Modal */}
            <AlertDialog open={true} onOpenChange={open=>{if(!open) setSelectedReq(null)}}>
              <AlertDialogTrigger asChild><span /></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Solicitação {selectedReq.id}</AlertDialogTitle>
                  <AlertDialogDescription>
                    OS: {selectedReq.workOrderId} · Veículo: {db.vehicles.find(v=>v.id===db.workOrders.find(w=>w.id===selectedReq.workOrderId)?.vehicleId)?.name} ({db.vehicles.find(v=>v.id===db.workOrders.find(w=>w.id===selectedReq.workOrderId)?.vehicleId)?.plate}) · Mecânico: {db.mechanics.find(m=>m.id===selectedReq.requesterId)?.name}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peça</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Estoque atual</TableHead>
                      <TableHead>Disponibilidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReq.items.map((it, idx) => {
                      const part = db.parts.find(p => p.id === it.partId);
                      const enough = part && part.stock >= it.quantity;
                      return (
                        <TableRow key={idx}>
                          <TableCell>{part?.name}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right">{part?.stock}</TableCell>
                          <TableCell>{enough ? <Badge variant="success">Disponível</Badge> : <Badge variant="destructive">Estoque insuficiente</Badge>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm}><CheckCircle className="mr-1 h-3 w-3" /> Confirmar retirada</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reject Modal */}
            <Dialog open={true} onOpenChange={open=>{if(!open){ setSelectedReq(null); setRejectReason(""); }}}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Recusar solicitação {selectedReq.id}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Textarea
                    placeholder="Justificativa para recusa..."
                    value={rejectReason}
                    onChange={e=>setRejectReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={()=>{setSelectedReq(null); setRejectReason("")}}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleRejectConfirm} disabled={!rejectReason.trim()}>
                    <XCircle className="mr-1 h-4 w-4" /> Confirmar recusa
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}