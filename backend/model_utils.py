import joblib
import os

def save_model(model, filename="models/benderquant_model.pkl"):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    joblib.dump(model, filename)
    print(f"✅ Model kaydedildi: {filename}")

def load_model(filename="models/benderquant_model.pkl"):
    if os.path.exists(filename):
        print(f"📥 Model yüklendi: {filename}")
        return joblib.load(filename)
    else:
        raise FileNotFoundError(f"Model dosyası bulunamadı: {filename}")
