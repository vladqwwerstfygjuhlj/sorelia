from dotenv import load_dotenv
load_dotenv()

import os
import re
import uuid
from typing import Dict, Any, List, Optional

import requests
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
import os
print("BOT START")
print("CWD:", os.getcwd())
print("BOT_TOKEN set:", bool(os.getenv("BOT_TOKEN")))
print("ADMIN_ID:", os.getenv("ADMIN_ID"))
print("API_BASE:", os.getenv("API_BASE"))

# ---------------------------
# CONFIG
# ---------------------------
TOKEN = os.getenv("BOT_TOKEN")
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:5000")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))


CATEGORIES = ["Каблучки", "Сережки", "Браслети", "Підвіски", "Шарми", "Інше"]

# conversation states
(
    ST_NAME,
    ST_CATEGORY,
    ST_PRICE,
    ST_SIZES,
    ST_PHOTO,
    ST_MOOD,
    ST_CONFIRM,
    ST_DELETE_ID,
) = range(8)


# ---------------------------
# HELPERS
# ---------------------------
def require_admin(update: Update) -> bool:
    """Allow only ADMIN_ID (if set)."""
    if not ADMIN_ID:
        return True  # if you didn't set ADMIN_ID, bot is open (not recommended)
    uid = update.effective_user.id if update.effective_user else 0
    return uid == ADMIN_ID


async def deny(update: Update, text: str = "Немає доступу.") -> None:
    if update.message:
        await update.message.reply_text(text)
    elif update.callback_query:
        await update.callback_query.answer(text, show_alert=True)


def make_product_id(name: str) -> str:
    """
    Generates a readable unique id.
    Example: ringquiet-a3f9
    """
    base = re.sub(r"[^a-zA-Z0-9]+", "", name.lower())
    base = base[:10] if base else "item"
    return f"{base}-{uuid.uuid4().hex[:4]}"


def fmt_preview(d: Dict[str, Any]) -> str:
    sizes = d.get("sizes") or []
    sizes_str = ", ".join(sizes) if sizes else "—"
    return (
        "Перевір дані:\n\n"
        f"ID: {d.get('id')}\n"
        f"Назва: {d.get('name')}\n"
        f"Категорія: {d.get('category')}\n"
        f"Ціна: {d.get('price')} грн\n"
        f"Розміри: {sizes_str}\n"
        f"Фото: {d.get('image')}\n"
        f"Опис: {d.get('mood')}\n"
    )


def api_get_products() -> List[Dict[str, Any]]:
    r = requests.get(f"{API_BASE}/api/products", timeout=15)
    r.raise_for_status()
    return r.json()


def api_upsert_product(payload: Dict[str, Any]) -> None:
    r = requests.post(f"{API_BASE}/api/products", json=payload, timeout=15)
    r.raise_for_status()


def api_delete_product(pid: str) -> bool:
    r = requests.delete(f"{API_BASE}/api/products/{pid}", timeout=15)
    r.raise_for_status()
    return bool(r.json().get("ok"))


def api_upload_image(file_bytes: bytes, filename: str = "product.jpg") -> str:
    files = {"file": (filename, file_bytes)}
    r = requests.post(f"{API_BASE}/api/upload", files=files, timeout=30)
    r.raise_for_status()
    path = r.json().get("path")
    if not path:
        raise RuntimeError("Upload did not return path")
    return path

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not require_admin(update):
        await deny(update)
        return

    await update.message.reply_text(
        "SORELIA • керування товарами\n\n"
        "Команди:\n"
        "/add — додати товар (майстер)\n"
        "/delete — видалити товар\n"
        "/list — список товарів\n"
        "/cancel — скасувати дію"
    )


async def cmd_list(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not require_admin(update):
        await deny(update)
        return

    try:
        items = api_get_products()
    except Exception as e:
        await update.message.reply_text(f"Не можу отримати список товарів.\n{e}")
        return

    if not items:
        await update.message.reply_text("Поки немає товарів.")
        return

    lines = []
    for p in items[:80]:
        lines.append(f"{p.get('id')} — {p.get('name')} — {p.get('price')} грн")
    await update.message.reply_text("\n".join(lines))


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    context.user_data.clear()
    await update.message.reply_text("Ок, скасовано.")
    return ConversationHandler.END


# ---------------------------
# ADD FLOW
# ---------------------------
async def add_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    context.user_data.clear()
    await update.message.reply_text("Назва товару?")
    return ST_NAME


async def add_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    name = (update.message.text or "").strip()
    if len(name) < 3:
        await update.message.reply_text("Напиши назву трохи повнішу 🙂")
        return ST_NAME

    context.user_data["name"] = name
    context.user_data["id"] = make_product_id(name)

    kb = InlineKeyboardMarkup(
        [[InlineKeyboardButton(c, callback_data=f"cat:{c}")] for c in CATEGORIES]
    )
    await update.message.reply_text("Категорія?", reply_markup=kb)
    return ST_CATEGORY


async def add_category(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    await q.answer()

    cat = q.data.split(":", 1)[1]
    context.user_data["category"] = cat
    await q.edit_message_text(f"Категорія: {cat}\n\nТепер ціна (числом, грн):")
    return ST_PRICE


async def add_price(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    txt = (update.message.text or "").strip().replace(" ", "")
    if not txt.isdigit():
        await update.message.reply_text("Напиши тільки число. Напр: 1290")
        return ST_PRICE

    price = int(txt)
    if price <= 0:
        await update.message.reply_text("Ціна має бути > 0.")
        return ST_PRICE

    context.user_data["price"] = price

    await update.message.reply_text(
        "Розміри?\n"
        "• Для каблучок: 15,16,17\n"
        "• Якщо не потрібно: -"
    )
    return ST_SIZES


async def add_sizes(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    txt = (update.message.text or "").strip()

    if txt == "-" or txt.lower() in ["ні", "нет", "no"]:
        sizes: List[str] = []
    else:
        parts = [p.strip() for p in txt.split(",") if p.strip()]
        # light validation: sizes should be short
        if any(len(p) > 4 for p in parts):
            await update.message.reply_text("Розміри виглядають дивно. Приклад: 15,16,17 або -")
            return ST_SIZES
        sizes = parts[:20]

    context.user_data["sizes"] = sizes

    await update.message.reply_text("Надішли фото товару (як фото, не файлом).")
    return ST_PHOTO


async def add_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message.photo:
        await update.message.reply_text("Потрібно саме фото (картинка). Спробуй ще раз.")
        return ST_PHOTO

    try:
        photo = update.message.photo[-1]
        tg_file = await context.bot.get_file(photo.file_id)
        data = await tg_file.download_as_bytearray()
        # upload to backend
        img_path = api_upload_image(bytes(data), filename="product.jpg")
        context.user_data["image"] = img_path
    except Exception as e:
        await update.message.reply_text(f"Не вийшло завантажити фото.\n{e}")
        return ST_PHOTO

    await update.message.reply_text(
        "Короткий опис/настрій (1–2 речення).\n"
        "Напр: «Тиха лінія й чиста форма на щодень.»"
    )
    return ST_MOOD


async def add_mood(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    mood = (update.message.text or "").strip()
    if len(mood) < 3:
        await update.message.reply_text("Можна трохи змістовніше, але коротко 🙂")
        return ST_MOOD

    context.user_data["mood"] = mood

    preview = fmt_preview(context.user_data)
    kb = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("✅ Зберегти", callback_data="confirm:save"),
                InlineKeyboardButton("❌ Скасувати", callback_data="confirm:cancel"),
            ]
        ]
    )
    await update.message.reply_text(preview, reply_markup=kb)
    return ST_CONFIRM


async def add_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    await q.answer()

    action = q.data.split(":", 1)[1]
    if action == "cancel":
        context.user_data.clear()
        await q.edit_message_text("Скасовано.")
        return ConversationHandler.END

    # SAVE
    d = context.user_data
    payload = {
        "id": d["id"],
        "sku": d.get("sku", ""),
        "name": d["name"],
        "price": d["price"],
        "category": d["category"],
        "image": d["image"],  # like /assets/img/xxx.jpg
        "mood": d["mood"],
        "sizes": d.get("sizes", []),
        "specs": d.get("specs", {"metal": "Срібло 925", "finish": "", "sizes": ""}),
    }

    try:
        api_upsert_product(payload)
    except Exception as e:
        await q.edit_message_text(f"Не вийшло зберегти товар.\n{e}")
        return ConversationHandler.END

    await q.edit_message_text("Готово ✅ Товар додано на сайт.")
    context.user_data.clear()
    return ConversationHandler.END


# ---------------------------
# DELETE FLOW
# ---------------------------
async def delete_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    await update.message.reply_text("Вкажи ID товару для видалення (напр: ringquiet-a3f9):")
    return ST_DELETE_ID


async def delete_id(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not require_admin(update):
        await deny(update)
        return ConversationHandler.END

    pid = (update.message.text or "").strip()
    if len(pid) < 3:
        await update.message.reply_text("ID виглядає закоротким. Спробуй ще раз.")
        return ST_DELETE_ID

    try:
        ok = api_delete_product(pid)
    except Exception as e:
        await update.message.reply_text(f"Не вийшло видалити.\n{e}")
        return ConversationHandler.END

    await update.message.reply_text("Видалено ✅" if ok else "Не знайдено ❗")
    return ConversationHandler.END


# ---------------------------
# MAIN
# ---------------------------
def main() -> None:
    if not TOKEN:
        raise RuntimeError("BOT_TOKEN is not set. Set env var BOT_TOKEN.")
    if not ADMIN_ID:
        raise RuntimeError("ADMIN_ID is not set. Set env var ADMIN_ID to your Telegram user id.")

    app = Application.builder().token(TOKEN).build()

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("add", add_start),
            CommandHandler("delete", delete_start),
        ],
        states={
            ST_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_name)],
            ST_CATEGORY: [CallbackQueryHandler(add_category, pattern=r"^cat:")],
            ST_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_price)],
            ST_SIZES: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_sizes)],
            ST_PHOTO: [MessageHandler(filters.PHOTO, add_photo)],
            ST_MOOD: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_mood)],
            ST_CONFIRM: [CallbackQueryHandler(add_confirm, pattern=r"^confirm:")],
            ST_DELETE_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, delete_id)],
        },
        fallbacks=[CommandHandler("cancel", cmd_cancel)],
        allow_reentry=True,
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("list", cmd_list))
    app.add_handler(conv)

    app.run_polling()


if __name__ == "__main__":
    main()
