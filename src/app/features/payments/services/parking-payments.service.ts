import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { environment } from '../../../../environments/environment';
import { PARKING_PAYMENTS_MOCK } from '../data/parking-payments.mock';
import {
  ParkingModality,
  ParkingModalityOption,
  ParkingPayment,
  ParkingPaymentMethod,
  ParkingPaymentStatus
} from '../models/parking-payment.model';

interface PaymentsResponse { data: ParkingPayment[]; }
interface CatalogsResponse { modalities: ParkingModalityOption[]; }
interface PaymentMutationResponse { success: boolean; id: number; authorizationId: number | null; }

export interface CreateParkingPaymentRequest {
  parkingUserId: number;
  vehicleId: number;
  modality: ParkingModality;
  startDate: string;
  method: ParkingPaymentMethod;
  reference: string | null;
  status: Extract<ParkingPaymentStatus, 'PENDIENTE' | 'APROBADO'>;
  issueAuthorization: boolean;
}

@Injectable({ providedIn: 'root' })
export class ParkingPaymentsService {
  private readonly api = inject(N8nApiService);
  private readonly mockPayments = structuredClone(PARKING_PAYMENTS_MOCK);

  list(): Observable<ParkingPayment[]> {
    if (environment.useMocks) return of(structuredClone(this.mockPayments));
    return this.api.get<PaymentsResponse>(N8N_WEBHOOKS.parkingPaymentsList)
      .pipe(map(response => response.data));
  }

  catalogs(): Observable<ParkingModalityOption[]> {
    if (environment.useMocks) {
      return of([
        { id: 1, modality: 'DIARIO', vehicleType: 'AUTO', amount: 1.5 },
        { id: 2, modality: 'DIARIO', vehicleType: 'MOTO', amount: 1.5 },
        { id: 3, modality: 'MENSUAL', vehicleType: 'AUTO', amount: 25 },
        { id: 4, modality: 'MENSUAL', vehicleType: 'MOTO', amount: 25 }
      ]);
    }
    return this.api.get<CatalogsResponse>(N8N_WEBHOOKS.parkingPaymentsCatalogs)
      .pipe(map(response => response.modalities));
  }

  create(request: CreateParkingPaymentRequest): Observable<PaymentMutationResponse> {
    if (environment.useMocks) {
      const id = Math.max(0, ...this.mockPayments.map(payment => payment.id)) + 1;
      const endDate = new Date(`${request.startDate}T00:00:00Z`);
      if (request.modality === 'MENSUAL') endDate.setUTCDate(endDate.getUTCDate() + 29);
      this.mockPayments.unshift({
        id,
        parkingUserId: request.parkingUserId,
        vehicleId: request.vehicleId,
        modality: request.modality,
        amount: request.modality === 'DIARIO' ? 1.5 : 25,
        startDate: request.startDate,
        endDate: endDate.toISOString().slice(0, 10),
        status: request.status,
        method: request.method,
        reference: request.reference,
        authorizationIssued: request.status === 'APROBADO' && request.issueAuthorization
      });
      return of({ success: true, id, authorizationId: request.issueAuthorization ? id : null });
    }
    return this.api.post<PaymentMutationResponse, CreateParkingPaymentRequest>(
      N8N_WEBHOOKS.parkingPaymentCreate,
      request
    );
  }

  approve(paymentId: number, startDate: string): Observable<PaymentMutationResponse> {
    if (environment.useMocks) {
      const payment = this.mockPayments.find(item => item.id === paymentId);
      if (!payment || payment.status !== 'PENDIENTE') {
        throw new Error('El pago no está pendiente.');
      }
      const endDate = new Date(`${startDate}T00:00:00Z`);
      if (payment.modality === 'MENSUAL') endDate.setUTCDate(endDate.getUTCDate() + 29);
      payment.status = 'APROBADO';
      payment.startDate = startDate;
      payment.endDate = endDate.toISOString().slice(0, 10);
      payment.authorizationIssued = true;
      return of({ success: true, id: payment.id, authorizationId: payment.id });
    }
    return this.api.patch<PaymentMutationResponse, { id: number; startDate: string }>(
      N8N_WEBHOOKS.parkingPaymentApprove,
      { id: paymentId, startDate }
    );
  }
}
