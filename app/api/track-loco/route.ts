// app/api/track-loco/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import LocoData from '@/models/LocoData';

export interface TrackingData {
  lat: number;
  lng: number;
  station: string;
  event: string;
  speed: string;
}

export interface TrackingApiResponse {
  current: TrackingData;
  history: { lat: number, lng: number, timestamp?: string, station?: string, event?: string, speed?: string }[];
}

function parsePopupMsg(html: string): Omit<TrackingData, 'lat' | 'lng'> {
    const stationMatch = html.match(/Station: <b>(.*?)<\/b>/);
    const eventMatch = html.match(/Event: <b>(.*?)<\/b>/);
    const speedMatch = html.match(/Speed: <b>(.*?)<\/b>/);
    return {
        station: stationMatch ? stationMatch[1] : 'N/A',
        event: eventMatch ? eventMatch[1] : 'N/A',
        speed: speedMatch ? speedMatch[1] : 'N/A',
    };
}

export async function POST(request: Request) {
  try {
    const { locoId } = await request.json();
    if (!locoId) {
      return NextResponse.json({ error: 'Loco ID is required' }, { status: 400 });
    }

    console.log(`Fetching data for loco: ${locoId}`);

    // 1. Fetch live data from FOIS first
    const apiUrl = `https://fois.indianrail.gov.in/foisweb/GG_AjaxInteraction?Optn=RTIS_CURRENT_LOCO_RPTG&Loco=${locoId}`;
    const foisResponse = await fetch(apiUrl, { method: 'POST' });
    if (!foisResponse.ok) throw new Error(`FOIS API failed: ${foisResponse.status}`);
    const foisData = await foisResponse.json();
    
    if (foisData.RowCont === "0" || !foisData.LocoDtls) {
      return NextResponse.json({ error: 'Loco not found or no data available.' }, { status: 404 });
    }

    const currentDetails = foisData.LocoDtls[0];
    const parsedInfo = parsePopupMsg(currentDetails.PopUpMsg);
    const currentData: TrackingData = {
      lat: parseFloat(currentDetails.Lttd),
      lng: parseFloat(currentDetails.Lgtd),
      ...parsedInfo,
    };

    console.log('Current data from FOIS:', currentData);

    // 2. Connect to DB and get the EXISTING history
    await dbConnect();
    const historyRecords = await LocoData.find({ locoId }).sort({ createdAt: 'asc' });
    
    console.log(`Found ${historyRecords.length} history records in DB`);
    console.log('Sample history record:', historyRecords[0]); // Debug log

    // 3. Compare the new data with the last point in our history
    const lastRecord = historyRecords.length > 0 ? historyRecords[historyRecords.length - 1] : null;
    
    // Use a small tolerance for coordinate comparison (GPS can have slight variations)
    const COORDINATE_TOLERANCE = 0.0001;
    const hasMoved = !lastRecord || 
      Math.abs(lastRecord.lat - currentData.lat) > COORDINATE_TOLERANCE || 
      Math.abs(lastRecord.lng - currentData.lng) > COORDINATE_TOLERANCE;
    
    console.log('Has moved:', hasMoved);
    
    // 4. If the loco has moved, save the new point to the DB
    let newRecordSaved = false;
    if (hasMoved) {
      try {
        await LocoData.create({
          locoId: locoId,
          ...currentData
        });
        newRecordSaved = true;
        console.log('New record saved to DB');
      } catch (err) {
        console.error("Failed to save new record:", err);
        // Continue execution even if save fails
      }
    }

    // 5. Construct the final history payload
    const finalHistory = historyRecords.map((rec, index) => {
      console.log(`History record ${index}:`, {
        station: rec.station,
        event: rec.event,
        speed: rec.speed,
        lat: rec.lat,
        lng: rec.lng
      });
      
      return {
        lat: rec.lat, 
        lng: rec.lng,
        timestamp: rec.createdAt ? new Date(rec.createdAt).toLocaleString() : undefined,
        // For older records that might not have these fields, use fallback values
        station: rec.station || 'Historical Position',
        event: rec.event || 'N/A',
        speed: rec.speed || 'N/A'
      };
    });
    
    // Add the current position to history if it's new
    if (hasMoved && newRecordSaved) {
      finalHistory.push({ 
        lat: currentData.lat, 
        lng: currentData.lng,
        timestamp: new Date().toLocaleString(),
        station: currentData.station,
        event: currentData.event,
        speed: currentData.speed
      });
    } else if (!hasMoved && finalHistory.length === 0) {
      // If no movement but also no history, add current position
      finalHistory.push({ 
        lat: currentData.lat, 
        lng: currentData.lng,
        timestamp: new Date().toLocaleString(),
        station: currentData.station,
        event: currentData.event,
        speed: currentData.speed
      });
    }

    console.log(`Returning ${finalHistory.length} history points`);

    // 6. Return the response
    const responsePayload: TrackingApiResponse = {
      current: currentData,
      history: finalHistory,
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('API Route Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}