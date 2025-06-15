// Exceptions/CustomExceptions.cs
namespace PredictiveMaintenance.API.Exceptions
{
    public class NotFoundException : Exception
    {
        public NotFoundException(string message) : base(message) { }
    }

    public class ValidationException : Exception
    {
        public ValidationException(string message) : base(message) { }
    }

    public class OperationException : Exception
    {
        public OperationException(string message) : base(message) { }
    }
}