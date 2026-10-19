package ru.dvizh.api;

public final class Problem extends RuntimeException {
    public final int status;
    public final Api.ErrorCode code;
    public final Integer retryAfter;
    public Problem(int status, Api.ErrorCode code, String message) { this(status,code,message,null); }
    public Problem(int status, Api.ErrorCode code, String message,Integer retryAfter) { super(message); this.status=status; this.code=code;this.retryAfter=retryAfter; }
    public static Problem notFound() { return new Problem(404,Api.ErrorCode.NOT_FOUND,"Объект не найден"); }
    public static Problem forbidden() { return new Problem(403,Api.ErrorCode.FORBIDDEN,"Нет доступа"); }
    public static Problem invalid(String message) { return new Problem(400,Api.ErrorCode.VALIDATION_ERROR,message); }
    public static Problem conflict(Api.ErrorCode code,String message) { return new Problem(409,code,message); }
    public static Problem transition() { return conflict(Api.ErrorCode.INVALID_STATUS_TRANSITION,"Действие недоступно в текущем состоянии"); }
}
