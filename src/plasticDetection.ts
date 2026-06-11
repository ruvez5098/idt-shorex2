import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

const COCO_TO_PLASTIC: Record<string, string> = {
  bottle: 'plastic bottle',
  cup: 'plastic cup',
  'wine glass': 'plastic cup',
  handbag: 'plastic bag',
  backpack: 'plastic bag',
  wallet: 'plastic bag',
  fork: 'plastic utensil',
  spoon: 'plastic utensil',
  knife: 'plastic utensil',
};

class PlasticDetectionModel {
  private customModel: tf.LayersModel | tf.GraphModel | null = null;
  private cocoModel: cocoSsd.ObjectDetection | null = null;
  private modelReady = false;
  private useCustomModel = false;

  async loadModel(modelPath: string = '/models/plastic-detection-model.json') {
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch (backendError) {
      console.warn('WebGL backend unavailable, falling back to default TFJS backend:', backendError);
    }

    try {
      console.log('Checking for custom TFJS model at', modelPath);
      const modelUrl = new URL(modelPath, window.location.href).toString();
      const headResponse = await fetch(modelUrl, { method: 'HEAD' });
      if (!headResponse.ok) {
        console.info('Custom model not found, using fallback:', modelPath, headResponse.status);
      } else {
        console.log('Custom model found, loading from', modelPath);
        try {
          this.customModel = await tf.loadLayersModel(modelPath);
        } catch (layersError) {
          console.warn('Layers model load failed, trying GraphModel:', layersError);
          this.customModel = await tf.loadGraphModel(modelPath);
        }

        if (this.customModel) {
          this.modelReady = true;
          this.useCustomModel = true;
          console.log('Custom plastic detection model loaded successfully');
          return true;
        }
      }
    } catch (modelError) {
      console.warn('Custom model load failed or was not available:', modelError);
    }

    try {
      console.log('Loading COCO-SSD fallback model');
      this.cocoModel = await cocoSsd.load();
      this.modelReady = true;
      this.useCustomModel = false;
      console.log('COCO-SSD fallback model loaded successfully');
      return true;
    } catch (fallbackError) {
      console.error('COCO-SSD fallback load failed:', fallbackError);
    }

    return false;
  }

  async detectPlastics(imageData: ImageData | HTMLCanvasElement | HTMLImageElement): Promise<Detection[]> {
    if (!this.modelReady) {
      console.error('Model not ready');
      return [];
    }

    if (this.useCustomModel && this.customModel) {
      return this.detectWithCustomModel(imageData);
    }

    if (this.cocoModel) {
      return this.detectWithCoco(imageData);
    }

    return [];
  }

  private async detectWithCustomModel(imageData: ImageData | HTMLCanvasElement | HTMLImageElement): Promise<Detection[]> {
    try {
      const imageTensor = tf.browser.fromPixels(imageData, 3).toFloat() as tf.Tensor3D;
      const normalized = imageTensor.div(255.0);
      const resized = tf.image.resizeBilinear(normalized as tf.Tensor3D, [416, 416]);
      const batched = resized.expandDims(0);

      const predictionOutput = this.customModel!.predict(batched);
      const predictions = Array.isArray(predictionOutput)
        ? predictionOutput.find((item) => item != null) as tf.Tensor
        : (predictionOutput as tf.Tensor);

      const detections = await this.parseDetections(predictions, imageTensor.shape[1], imageTensor.shape[0]);

      tf.dispose([imageTensor, normalized, resized, batched]);
      if (Array.isArray(predictionOutput)) {
        predictionOutput.forEach((tensor) => tensor && tf.dispose(tensor));
      } else if (predictionOutput) {
        tf.dispose(predictionOutput);
      }

      return detections;
    } catch (error) {
      console.error('Custom model detection failed:', error);
      return [];
    }
  }

  private async detectWithCoco(imageData: ImageData | HTMLCanvasElement | HTMLImageElement): Promise<Detection[]> {
    try {
      const predictions = await this.cocoModel!.detect(imageData as any, 10, 0.4);
      return predictions
        .map((prediction) => {
          const mapped = COCO_TO_PLASTIC[prediction.class] ?? null;
          if (!mapped) {
            return null;
          }
          return {
            class: mapped,
            confidence: prediction.score,
            bbox: [
              prediction.bbox[0],
              prediction.bbox[1],
              prediction.bbox[2],
              prediction.bbox[3],
            ] as [number, number, number, number],
          };
        })
        .filter((prediction): prediction is Detection => prediction !== null);
    } catch (error) {
      console.error('COCO detection failed:', error);
      return [];
    }
  }

  private async parseDetections(predictions: tf.Tensor, inputWidth: number, inputHeight: number): Promise<Detection[]> {
    if (!predictions) {
      return [];
    }

    let tensor = predictions;
    if (tensor.shape.length === 3 && tensor.shape[0] === 1) {
      tensor = tensor.squeeze([0]);
    }
    if (tensor.shape.length !== 2 || tensor.shape[1] < 6) {
      return [];
    }

    const rawData = await tensor.array() as number[][];
    let maxValue = Number.NEGATIVE_INFINITY;
    for (const row of rawData) {
      for (let i = 0; i < Math.min(4, row.length); i += 1) {
        if (row[i] > maxValue) {
          maxValue = row[i];
        }
      }
    }

    const isNormalized = maxValue <= 1.01;
    const scaleX = isNormalized ? inputWidth : 1;
    const scaleY = isNormalized ? inputHeight : 1;

    const boxes: number[][] = [];
    const scores: number[] = [];

    for (const row of rawData) {
      const [cx, cy, w, h, objectConfidence, ...classScores] = row;
      if (classScores.length === 0) {
        continue;
      }

      const bestClassIndex = classScores.indexOf(Math.max(...classScores));
      const classConfidence = classScores[bestClassIndex] ?? 0;
      const confidence = objectConfidence * classConfidence;
      if (confidence < 0.25) {
        continue;
      }

      const x = cx - w / 2;
      const y = cy - h / 2;
      const x1 = Math.max(0, x * scaleX);
      const y1 = Math.max(0, y * scaleY);
      const x2 = Math.min(inputWidth, (x + w) * scaleX);
      const y2 = Math.min(inputHeight, (y + h) * scaleY);
      if (x2 <= x1 || y2 <= y1) {
        continue;
      }

      boxes.push([y1, x1, y2, x2]);
      scores.push(confidence);
    }

    if (boxes.length === 0) {
      return [];
    }

    const boxesTensor = tf.tensor2d(boxes);
    const scoresTensor = tf.tensor1d(scores);
    const selectedIndices = await tf.image.nonMaxSuppressionAsync(
      boxesTensor,
      scoresTensor,
      20,
      0.45,
      0.25,
    );

    const indices = await selectedIndices.array();
    tf.dispose([boxesTensor, scoresTensor, selectedIndices]);

    return indices.map((idx) => {
      const [y1, x1, y2, x2] = boxes[idx];
      return {
        class: 'plastic',
        confidence: scores[idx],
        bbox: [x1, y1, x2 - x1, y2 - y1],
      };
    });
  }

  isReady(): boolean {
    return this.modelReady;
  }

  dispose() {
    if (this.customModel) {
      this.customModel.dispose();
    }
    this.customModel = null;
    this.cocoModel = null;
    this.modelReady = false;
    this.useCustomModel = false;
  }
}

export const plasticDetectionModel = new PlasticDetectionModel();
