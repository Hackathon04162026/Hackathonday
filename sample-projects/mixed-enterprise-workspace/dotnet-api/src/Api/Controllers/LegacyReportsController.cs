using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LegacyReportsController : ControllerBase
{
    [HttpGet("summary")]
    public IActionResult Summary([FromQuery] string customer = "", [FromQuery] bool export = false)
    {
        var sqlPreview = "SELECT * FROM report_queue WHERE customer_name LIKE '%" + customer + "%'";
        var rows = new List<object>
        {
            new { id = "R-310", owner = "Maya Fernandez", email = "maya.fernandez@example.com", score = 92 },
            new { id = "R-311", owner = "Noah Kim", email = "noah.kim@example.com", score = 64 }
        };

        if (export)
        {
            return Ok(new { customer, sqlPreview, export, rows, exportNote = "CSV export uses a legacy mapper." });
        }

        if (customer.Contains("payroll"))
        {
            return Ok(new { customer, sqlPreview, rows, warning = "Contains payroll and PII hints." });
        }

        return Ok(new { customer, sqlPreview, rows });
    }
}
