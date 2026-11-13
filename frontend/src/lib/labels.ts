export function statusLabel(status: string) {
  switch (status) {
    case "queued":
      return "В очереди";
    case "processing":
      return "Обработка";
    case "ready":
      return "Готов";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

export function attributeStatusLabel(status: string) {
  switch (status) {
    case "found":
      return "найдено";
    case "missing":
      return "не найдено";
    case "ambiguous":
      return "неоднозначно";
    default:
      return status;
  }
}
