package ru.dvizh.api;

import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class Errors {
    private static final Logger log=LoggerFactory.getLogger(Errors.class);
    @ExceptionHandler(Problem.class)
    ResponseEntity<Api.ApiError> problem(Problem e,HttpServletRequest req) {
        var result=response(e.status,e.code,e.getMessage(),List.of(),req);
        if(e.retryAfter!=null) return ResponseEntity.status(e.status).header("Retry-After",e.retryAfter.toString()).body(result.getBody());
        return result;
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Api.ApiError> validation(MethodArgumentNotValidException e,HttpServletRequest req) {
        return response(400,Api.ErrorCode.VALIDATION_ERROR,"Проверьте поля запроса",e.getBindingResult().getFieldErrors().stream()
            .map(f -> new Api.ErrorField(f.getField(),f.getDefaultMessage())).toList(),req);
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentTypeMismatchException.class,ConstraintViolationException.class,
        org.springframework.web.bind.MissingServletRequestParameterException.class})
    ResponseEntity<Api.ApiError> invalid(Exception e,HttpServletRequest req) {
        return response(400,Api.ErrorCode.VALIDATION_ERROR,"Неверный формат запроса",List.of(),req);
    }
    @ExceptionHandler({DataIntegrityViolationException.class,OptimisticLockingFailureException.class,PessimisticLockingFailureException.class})
    ResponseEntity<Api.ApiError> conflict(Exception e,HttpServletRequest req) {
        return response(409,Api.ErrorCode.CONFLICT,"Данные изменились или нарушено ограничение уникальности. Обновите страницу",List.of(),req);
    }
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    ResponseEntity<Api.ApiError> missing(Exception e,HttpServletRequest req) { return response(404,Api.ErrorCode.NOT_FOUND,"Ресурс не найден",List.of(),req); }
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Api.ApiError> unsupported(Exception e,HttpServletRequest req) { return response(405,Api.ErrorCode.VALIDATION_ERROR,"Метод не поддерживается",List.of(),req); }
    @ExceptionHandler(Exception.class)
    ResponseEntity<Api.ApiError> unexpected(Exception e,HttpServletRequest req) {
        log.error("Request {} failed",req.getAttribute("requestId"),e);
        return response(500,Api.ErrorCode.INTERNAL_ERROR,"Внутренняя ошибка сервера",List.of(),req);
    }
    private ResponseEntity<Api.ApiError> response(int status,Api.ErrorCode code,String message,List<Api.ErrorField> details,HttpServletRequest req) {
        String id=Objects.toString(req.getAttribute("requestId"),UUID.randomUUID().toString());
        return ResponseEntity.status(status).body(new Api.ApiError(code,message,details,id));
    }
}
