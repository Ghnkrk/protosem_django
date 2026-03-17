import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LLM_DIR = os.path.join(BASE_DIR, "llm")

MODEL_PATH = os.path.join(LLM_DIR, "nanollava-text-model-f16.gguf")
MMPROJ_PATH = os.path.join(LLM_DIR, "nanollava-mmproj-f16.gguf")

llm_text = None
llm_vision = None

def get_text_model():
    global llm_text
    if llm_text is None:
        try:
            from llama_cpp import Llama
            print("Loading text model globally...")
            llm_text = Llama(
                model_path=MODEL_PATH,
                n_ctx=4096,
                n_gpu_layers=0,
                verbose=False,
            )
            print("Text model loaded.")
        except Exception as e:
            print(f"Failed to load text model: {e}")
    return llm_text

def get_vision_model():
    global llm_vision
    if llm_vision is None:
        try:
            from llama_cpp import Llama
            from llama_cpp.llama_chat_format import Llava15ChatHandler
            print("Loading vision model globally...")
            chat_handler = Llava15ChatHandler(clip_model_path=MMPROJ_PATH, verbose=False)
            llm_vision = Llama(
                model_path=MODEL_PATH,
                chat_handler=chat_handler,
                n_ctx=4096,
                n_gpu_layers=0,
                verbose=False,
            )
            print("Vision model loaded.")
        except Exception as e:
            print(f"Failed to load vision model: {e}")
    return llm_vision
