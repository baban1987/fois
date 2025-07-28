// models/LocoData.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ILocoData extends Document {
  locoId: string;
  lat: number;
  lng: number;
  // Add these fields to the interface
  station: string;
  event: string;
  speed: string;
  createdAt: Date;
}

const LocoDataSchema: Schema = new Schema({
  locoId: { type: String, required: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // Add these fields to the schema
  station: { type: String, required: true },
  event: { type: String, required: true },
  speed: { type: String, required: true },
}, {
  timestamps: true,
});

// The TTL index remains the same
LocoDataSchema.index({ createdAt: 1 }, { expireAfterSeconds: 6 * 60 * 60 });

export default mongoose.models.LocoData || mongoose.model<ILocoData>('LocoData', LocoDataSchema);