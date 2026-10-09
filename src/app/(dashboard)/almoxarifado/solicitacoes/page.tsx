"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db, confirmWithdrawal, rejectRequest, groupRequestItems } from "@/lib/mocks";
import { Eye, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { toast } from "sonner";

type RequestItem = typeof db.partRequests[0];

export default function SolicitacoesPage() {
  useRoleGuard(["GESTOR", "ALMOXARIFADO"]);
  const [selectedReq, setSelectedReq] = useState<RequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [dialogMode, setDialogMode] = useState<"process" | "reject" | null>(null);

  const canProcess = (status: string) => status === "Pendente" || status === "Separada";

  const statusBadge = (s: string) => {
    switch (s) {
      case "Pendente": return <Badge variant="warning">{s}</Badge>;
      case "Separada": return <Badge variant="default">{s}</Badge>;
      case "Retirada confirmada": return <Badge variant="success">{s}</Badge>;
      case "Recusada": return <Badge variant="destructive">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  const openProcess = (req: RequestItem) => {
    if (!canProcess(req.status)) return;
    setSelectedReq(req);
    setDialogMode("process");
  };

  const openReject = (req: RequestItem) => {
    if (!canProcess(req.status)) return;
    setSelectedReq(req);
    setRejectReason("");
    setDialogMode("reject");
  };

  const closeDialog = () => {
    setSelectedReq(null);
    setRejectReason("");
    setDialogMode(null);
  };

  const handleConfirm = () => {
    if (!selectedReq) return;
    const result = confirmWithdrawal(selectedReq.id);
    if (result.success) {
      toast.success(result.message);
      closeDialog();
    } else {
      toast.error(result.message);
    }
  };

  const handleRejectConfirm = () => {
    if (!selectedReq) return;
    const result = rejectRequest(selectedReq.id, rejectReason);
    if (result.success) {
      toast.success(result.message);
      closeDialog();
    } else {
      toast.error(result.message);
    }
  };

  // Itens agrupados por peça (mesma peça pode aparecer mais de uma vez).
  const groupedItems = selectedReq
    ? Array.from(groupRequestItems(selectedReq.items).entries())
    : [];
  const hasShortage = groupedItems.some(([partId, qty]) => {
    const part = db.parts.find(p => p.id === partId);
    return !part || part.stock < qty;
  });

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
                    <TableRow key={req.id} className={canProcess(req.status) ? "bg-yellow-50" : ""}>
                      <TableCell className="font-mono">{req.id}</TableCell>
                      <TableCell>{wo?.id}</TableCell>
                      <TableCell>{vehicle?.name} ({vehicle?.plate})</TableCell>
                      <TableCell>{requester?.name}</TableCell>
                      <TableCell>{new Date(req.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{req.items.length}</TableCell>
                      <TableCell>{statusBadge(req.status)}</TableCell>
                      <TableCell className="text-right">
                        {canProcess(req.status) && (
                          <div className="flex items-center gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={()=>openReject(req)}><XCircle className="mr-1 h-3 w-3" /> Recusar</Button>
                            <Button size="sm" onClick={()=>openProcess(req)}><Eye className="mr-1 h-3 w-3" /> Processar</Button>
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

        {/* Process Modal */}
        {selectedReq && dialogMode === "process" && (
          <AlertDialog open={true} onOpenChange={open=>{ if(!open) closeDialog(); }}>
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
                  {groupedItems.map(([partId, qty]) => {
                    const part = db.parts.find(p => p.id === partId);
                    const enough = part && part.stock >= qty;
                    return (
                      <TableRow key={partId}>
                        <TableCell>{part?.name ?? partId}</TableCell>
                        <TableCell className="text-right">{qty}</TableCell>
                        <TableCell className="text-right">{part?.stock}</TableCell>
                        <TableCell>{enough ? <Badge variant="success">Disponível</Badge> : <Badge variant="destructive">Estoque insuficiente</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {hasShortage && (
                <p className="text-sm text-danger">Há itens sem estoque suficiente. A retirada será recusada.</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={(e)=>{ if(hasShortage){ e.preventDefault(); toast.error("Estoque insuficiente para concluir a retirada."); } else { handleConfirm(); } }}>
                  <CheckCircle className="mr-1 h-3 w-3" /> Confirmar retirada
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Reject Modal */}
        {selectedReq && dialogMode === "reject" && (
          <Dialog open={true} onOpenChange={open=>{ if(!open) closeDialog(); }}>
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
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button variant="destructive" onClick={handleRejectConfirm} disabled={!rejectReason.trim()}>
                  <XCircle className="mr-1 h-4 w-4" /> Confirmar recusa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
